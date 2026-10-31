import { router, Stack } from 'expo-router';
import { Switch, useToast } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { FormSection } from '@/components/ui/FormSection';
import { PickerField, type PickerOption } from '@/components/ui/PickerField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  createTransactionFormSchema,
  DESCRIPTION_MAX_LENGTH,
  DOCUMENT_NO_MAX_LENGTH,
  type TransactionFormOutput,
  type TransactionFormValues,
} from '@/core/forms/transaction';
import { MOVEMENT_RULES, type MovementType } from '@/core/ledger';
import { transactionsRepo, type Attachment } from '@/db';
import type { AttachmentInput } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';
import {
  deleteStoredAttachment,
  storeAttachment,
  type PendingAttachment,
} from '@/platform/attachments';
import { usePreferences } from '@/stores/preferences';
import { clearTransactionDraft, saveTransactionDraft } from '@/stores/transactionDraft';

import { AttachmentsField } from './AttachmentsField';
import { cashDefault } from './initialValues';
import { MovementTypeGrid } from './MovementTypeGrid';
import type { TransactionFormData } from './useTransactionFormData';

const DRAFT_DEBOUNCE_MS = 400;

/** Seçim listeleri: yeni seçimde yalnızca aktifler; düzenlenen kaydın mevcut (pasif) seçimi kalır (6.2). */
function keep<T extends { id: string; status: string }>(rows: readonly T[], current: string): T[] {
  return rows.filter((row) => row.status === 'active' || row.id === current);
}

type TransactionFormProps = {
  data: TransactionFormData;
  initialValues: TransactionFormValues;
  /** Cari detayından açıldıysa: "Yeni ekle" kısayolu aynı cariyle açılır. */
  presetContactId?: string;
} & (
  | { mode: 'new'; restoredDraft: TransactionFormValues | null }
  | { mode: 'edit'; transactionId: string; existingAttachments: readonly Attachment[] }
);

type Subscribe = UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>['subscribe'];

/**
 * Yarım kalan girişi MMKV'ye yazar (8.1); taslak varsa açılışta bir kez geri yükler.
 * `options` null ise (düzenleme) hiçbir şey yapmaz.
 * @returns Taslağı silen fonksiyon (kayıtta ve bilinçli "Çık" seçiminde).
 */
function useDraftAutosave(
  options: {
    initialValues: TransactionFormValues;
    restoredDraft: TransactionFormValues | null;
  } | null,
  subscribe: Subscribe,
  restore: (draft: TransactionFormValues) => void,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isEnabled = options !== null;

  useEffect(() => {
    if (!options) return;
    if (options.restoredDraft) restore(options.restoredDraft);
    const initialJson = JSON.stringify(options.initialValues);
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (JSON.stringify(values) === initialJson) clearTransactionDraft();
          else saveTransactionDraft(values);
        }, DRAFT_DEBOUNCE_MS);
      },
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
    // Yalnızca ilk açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useCallback(() => {
    clearTimeout(timer.current);
    if (isEnabled) clearTransactionDraft();
  }, [isEnabled]);
}

/**
 * Hareket ekle / düzenle (6.4). Hızlı giriş: en üstte tutar, altında hareket tipi; diğer alanlar akıllı
 * varsayılanlarla dolu. Alanlar hareket tipine göre MOVEMENT_RULES'tan görünür/gizlenir.
 */
export function TransactionForm(props: TransactionFormProps) {
  const { data, initialValues, presetContactId } = props;
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const { language } = useMoney();
  const setLastAccountId = usePreferences((s) => s.setLastAccountId);
  const isNew = props.mode === 'new';

  const schema = useMemo(() => createTransactionFormSchema({ language }), [language]);
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    subscribe,
    formState: { isDirty, isSubmitting },
  } = useForm<TransactionFormValues, unknown, TransactionFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });

  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const existing =
    props.mode === 'edit'
      ? props.existingAttachments.filter((a) => !removedIds.includes(a.id))
      : [];
  const attachmentsChanged = pending.length > 0 || removedIds.length > 0;

  // Taslak (8.1): yalnızca yeni harekette.
  const discardDraft = useDraftAutosave(
    isNew
      ? { initialValues, restoredDraft: props.mode === 'new' ? props.restoredDraft : null }
      : null,
    subscribe,
    (draft) => {
      // Varsayılanlar korunur; böylece form "değişmiş" sayılır ve çıkarken onay sorulur.
      reset(draft, { keepDefaultValues: true });
      toast.show({ label: t('transactionForm.draftRestored') });
    },
  );
  const leave = useConfirmDiscard(isDirty || attachmentsChanged, discardDraft);

  const movementType = useWatch({ control, name: 'movementType' });
  const contactId = useWatch({ control, name: 'contactId' });
  const rule = MOVEMENT_RULES[movementType];

  // "Peşin" elle değiştirilmediyse cari veya tip değişince carinin bakiyesine göre yeniden önerilir.
  const [isCashTouched, setIsCashTouched] = useState(false);
  const suggestCash = (nextType: MovementType, nextContactId: string) => {
    if (isCashTouched) return;
    setValue('isCash', cashDefault(data, nextType, nextContactId), { shouldDirty: true });
  };

  const descriptionRef = useRef<TextInput>(null);
  const documentNoRef = useRef<TextInput>(null);

  const contactOptions = useMemo<PickerOption[]>(
    () =>
      keep(data.contacts, initialValues.contactId).map((c) => ({
        value: c.id,
        label: c.name,
        description: [c.district, c.city].filter(Boolean).join(', ') || t(`contactRoles.${c.role}`),
      })),
    [data.contacts, initialValues.contactId, t],
  );
  const accountOptions = useMemo(
    () => keep(data.accounts, initialValues.accountId).map((a) => ({ value: a.id, label: a.name })),
    [data.accounts, initialValues.accountId],
  );
  const transactionTypeOptions = useMemo<PickerOption[]>(
    () =>
      keep(data.transactionTypes, initialValues.transactionTypeId)
        .filter((type) => type.direction === rule.transactionTypeDirection)
        .map((type) => ({ value: type.id, label: type.name })),
    [data.transactionTypes, initialValues.transactionTypeId, rule.transactionTypeDirection],
  );
  const subjectOptions = useMemo<PickerOption[]>(
    () => keep(data.subjects, initialValues.subjectId).map((s) => ({ value: s.id, label: s.name })),
    [data.subjects, initialValues.subjectId],
  );

  /** Tip değişince yönü uymayan işlem türü temizlenir (Tahsilat → gelir, Ödeme → gider türleri, 5.1). */
  const changeMovementType = (next: MovementType) => {
    setValue('movementType', next, { shouldDirty: true });
    const typeId = getValues('transactionTypeId');
    const direction = MOVEMENT_RULES[next].transactionTypeDirection;
    const type = data.transactionTypes.find((x) => x.id === typeId);
    if (type && type.direction !== direction) {
      setValue('transactionTypeId', '', { shouldDirty: true });
    }
    suggestCash(next, getValues('contactId'));
  };

  const save = async (output: TransactionFormOutput) => {
    const stored: AttachmentInput[] = [];
    try {
      for (const item of pending) stored.push(await storeAttachment(item));
      if (props.mode === 'new') {
        await transactionsRepo.create(output, stored);
      } else {
        await transactionsRepo.update(props.transactionId, output, {
          add: stored,
          removeIds: removedIds,
        });
      }
    } catch (error) {
      // Kayıt olmadıysa kopyalanan dosyalar da kalmasın.
      stored.forEach((item) => deleteStoredAttachment(item.fileUri));
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      return;
    }

    if (output.accountId) setLastAccountId(output.accountId);
    discardDraft();
    haptics.success();
    toast.show({
      variant: 'success',
      label: t('transactionForm.saved'),
      ...(isNew
        ? {
            actionLabel: t('transactionForm.addAnother'),
            onActionPress: ({ hide }: { hide: () => void }) => {
              hide();
              router.push({
                pathname: '/transaction/new',
                params: {
                  type: output.movementType,
                  ...(presetContactId ? { contactId: presetContactId } : {}),
                },
              });
            },
          }
        : {}),
    });
    leave();
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);
  const title = isNew
    ? t('transaction.newTitle', { type: t(`movementTypes.${movementType}`) })
    : t('transactionForm.editTitle');

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => router.back()}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <X size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <Controller
        control={control}
        name="amount"
        render={({ field, fieldState }) => (
          <AmountInput
            ref={field.ref}
            label={t('transactionForm.amount')}
            isRequired
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            autoFocus={isNew && !(props.mode === 'new' && props.restoredDraft)}
            returnKeyType="done"
          />
        )}
      />

      <Controller
        control={control}
        name="movementType"
        render={({ field }) => (
          <MovementTypeGrid value={field.value} onChange={changeMovementType} />
        )}
      />

      <Controller
        control={control}
        name="contactId"
        render={({ field, fieldState }) => (
          <PickerField
            label={t('transactionForm.contact')}
            placeholder={t(
              rule.contact === 'required'
                ? 'transactionForm.selectContact'
                : 'transactionForm.selectContactOptional',
            )}
            disabledPlaceholder={t('transactionForm.noContacts')}
            isRequired={rule.contact === 'required'}
            isClearable={rule.contact !== 'required'}
            value={field.value}
            options={contactOptions}
            onChange={(value: string) => {
              field.onChange(value);
              suggestCash(getValues('movementType'), value);
            }}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      {rule.cash === 'allowed' && contactId ? (
        <Controller
          control={control}
          name="isCash"
          render={({ field }) => (
            <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface px-4 py-3">
              <View className="flex-1 gap-0.5">
                <AppText weight="bold">{t('transactionForm.cash')}</AppText>
                <AppText className="text-[13px] leading-[18px] text-muted">
                  {t(
                    field.value
                      ? `transactionForm.cashHint.${movementType === 'payment' ? 'payment' : 'collection'}`
                      : `transactionForm.settleHint.${movementType === 'payment' ? 'payment' : 'collection'}`,
                  )}
                </AppText>
              </View>
              <Switch
                accessibilityLabel={t('transactionForm.cash')}
                isSelected={field.value}
                onSelectedChange={(selected) => {
                  setIsCashTouched(true);
                  field.onChange(selected);
                }}
              />
            </View>
          )}
        />
      ) : null}

      {rule.account === 'required' ? (
        <Controller
          control={control}
          name="accountId"
          render={({ field, fieldState }) => (
            <View className="gap-2">
              <AppText weight="semibold" className="text-[14px]">
                {t('transactionForm.account')}
              </AppText>
              {accountOptions.length > 0 ? (
                <ChipGroup
                  layout="wrap"
                  accessibilityLabel={t('transactionForm.account')}
                  options={accountOptions}
                  isSelected={(id) => id === field.value}
                  onPress={field.onChange}
                />
              ) : (
                <AppText className="text-[13px] text-muted">
                  {t('transactionForm.noAccounts')}
                </AppText>
              )}
              {fieldState.error ? (
                <AppText className="text-[13px] text-danger">
                  {errorText(fieldState.error.message)}
                </AppText>
              ) : null}
            </View>
          )}
        />
      ) : null}

      {rule.openingDirection === 'required' ? (
        <Controller
          control={control}
          name="openingDirection"
          render={({ field }) => (
            <View className="gap-2">
              <AppText weight="semibold" className="text-[14px]">
                {t('transactionForm.openingDirection')}
              </AppText>
              <SegmentedControl
                accessibilityLabel={t('transactionForm.openingDirection')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'receivable', label: t('contactForm.openingReceivable') },
                  { value: 'payable', label: t('contactForm.openingPayable') },
                ]}
              />
            </View>
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="date"
        render={({ field, fieldState }) => (
          <DateField
            label={t('transactionForm.date')}
            isRequired
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      {rule.dueDate === 'allowed' ? (
        <Controller
          control={control}
          name="dueDate"
          render={({ field, fieldState }) => (
            <DateField
              label={t('transactionForm.dueDate')}
              placeholder={t('transactionForm.noDueDate')}
              isClearable
              value={field.value}
              onChange={field.onChange}
              error={errorText(fieldState.error?.message)}
            />
          )}
        />
      ) : null}

      <FormSection title={t('transactionForm.detailsSection')}>
        {rule.transactionTypeDirection ? (
          <Controller
            control={control}
            name="transactionTypeId"
            render={({ field }) => (
              <PickerField
                label={t(
                  rule.transactionTypeDirection === 'income'
                    ? 'transactionForm.incomeType'
                    : 'transactionForm.expenseType',
                )}
                placeholder={t('transactionForm.selectType')}
                value={field.value}
                options={transactionTypeOptions}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="subjectId"
          render={({ field }) => (
            <PickerField
              label={t('transactionForm.subject')}
              placeholder={t('transactionForm.selectSubject')}
              value={field.value}
              options={subjectOptions}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <FormField
              ref={(node) => {
                field.ref(node);
                descriptionRef.current = node;
              }}
              label={t('transactionForm.description')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              autoCapitalize="sentences"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => documentNoRef.current?.focus()}
            />
          )}
        />

        <Controller
          control={control}
          name="documentNo"
          render={({ field, fieldState }) => (
            <FormField
              ref={(node) => {
                field.ref(node);
                documentNoRef.current = node;
              }}
              label={t('transactionForm.documentNo')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
              maxLength={DOCUMENT_NO_MAX_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
          )}
        />

        <AttachmentsField
          existing={existing}
          pending={pending}
          onAdd={(items) => setPending((prev) => [...prev, ...items])}
          onRemoveExisting={(id) => setRemovedIds((prev) => [...prev, id])}
          onRemovePending={(id) => setPending((prev) => prev.filter((p) => p.id !== id))}
        />
      </FormSection>
    </FormScreen>
  );
}
