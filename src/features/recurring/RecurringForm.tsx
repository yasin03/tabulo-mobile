import { useToast } from 'heroui-native';
import { Minus, Plus } from 'lucide-react-native';
import { useMemo, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { TimeField } from '@/components/ui/TimeField';
import {
  createRecurringFormSchema,
  RECURRING_TITLE_MAX_LENGTH,
  REMIND_DAYS_OPTIONS,
  type RecurringFormOutput,
  type RecurringFormValues,
} from '@/core/forms/recurring';
import { MOVEMENT_RULES } from '@/core/ledger';
import { MAX_INTERVAL, type Frequency } from '@/core/recurrence';
import { recurringPaymentsRepo } from '@/db';
import type { RecurringPaymentInput } from '@/db/repositories';
import { PermissionBanner } from '@/features/notifications/PermissionBanner';
import { useEnsureNotificationPermission } from '@/features/notifications/useNotificationPermission';
import type { TransactionFormData } from '@/features/transactions/useTransactionFormData';
import { useMoney } from '@/lib/business';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';

const FREQUENCY_OPTIONS: readonly Frequency[] = ['weekly', 'monthly', 'yearly'];

/** Seçim listeleri: yalnızca aktifler; düzenlenen kaydın mevcut (pasif) seçimi kalır. */
function keep<T extends { id: string; status: string }>(rows: readonly T[], current: string): T[] {
  return rows.filter((row) => row.status === 'active' || row.id === current);
}

type RecurringFormProps = {
  data: TransactionFormData;
  initialValues: RecurringFormValues;
} & (
  { mode: 'new' } | { mode: 'edit'; recurringId: string; startDate: string; nextDueDate: string }
);

/**
 * Düzenli ödeme ekle / düzenle (6.5): ödeme/tahsilat, başlık, tutar, sıklık × aralık, ilk/sonraki tarih,
 * bitiş, hesap, hatırlatma (kaç gün önce + saat), isteğe bağlı cari / tür / konu.
 */
export function RecurringForm(props: RecurringFormProps) {
  const { data, initialValues } = props;
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const { language, currency } = useMoney();
  const ensurePermission = useEnsureNotificationPermission();

  const schema = useMemo(() => createRecurringFormSchema({ language }), [language]);
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { isDirty, isSubmitting },
  } = useForm<RecurringFormValues, unknown, RecurringFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  const leave = useConfirmDiscard(isDirty);
  const amountRef = useRef<TextInput>(null);

  const movementType = useWatch({ control, name: 'movementType' });
  const frequency = useWatch({ control, name: 'frequency' });
  const interval = useWatch({ control, name: 'interval' });
  const direction = MOVEMENT_RULES[movementType].transactionTypeDirection;

  const accountOptions = useMemo(
    () => keep(data.accounts, initialValues.accountId).map((a) => ({ value: a.id, label: a.name })),
    [data.accounts, initialValues.accountId],
  );
  const contactOptions = useMemo<PickerOption[]>(
    () =>
      keep(data.contacts, initialValues.contactId).map((c) => ({
        value: c.id,
        label: c.name,
        description: [c.district, c.city].filter(Boolean).join(', ') || t(`contactRoles.${c.role}`),
      })),
    [data.contacts, initialValues.contactId, t],
  );
  const typeOptions = useMemo<PickerOption[]>(
    () =>
      keep(data.transactionTypes, initialValues.transactionTypeId)
        .filter((type) => type.direction === direction)
        .map((type) => ({ value: type.id, label: type.name })),
    [data.transactionTypes, initialValues.transactionTypeId, direction],
  );
  const subjectOptions = useMemo<PickerOption[]>(
    () => keep(data.subjects, initialValues.subjectId).map((s) => ({ value: s.id, label: s.name })),
    [data.subjects, initialValues.subjectId],
  );

  /** Tip değişince yönü uymayan işlem türü temizlenir (ödeme → gider, tahsilat → gelir). */
  const changeMovementType = (next: RecurringFormValues['movementType']) => {
    setValue('movementType', next, { shouldDirty: true });
    const type = data.transactionTypes.find((x) => x.id === getValues('transactionTypeId'));
    if (type && type.direction !== MOVEMENT_RULES[next].transactionTypeDirection) {
      setValue('transactionTypeId', '', { shouldDirty: true });
    }
  };

  const save = async (output: RecurringFormOutput) => {
    // Tarih veya sıklık değiştiyse tekrarlar yeni tarihten başlar; değişmediyse dayanak (ayın günü) korunur.
    const scheduleChanged =
      output.dueDate !== initialValues.dueDate ||
      output.frequency !== initialValues.frequency ||
      output.interval !== initialValues.interval;
    const startDate = props.mode === 'edit' && !scheduleChanged ? props.startDate : output.dueDate;
    const input: RecurringPaymentInput = {
      ...output,
      startDate,
      nextDueDate: output.dueDate,
      currency,
    };
    try {
      if (props.mode === 'new') await recurringPaymentsRepo.create(input);
      else await recurringPaymentsRepo.update(props.recurringId, input);
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      return;
    }
    haptics.success();
    toast.show({ variant: 'success', label: t('recurring.saved') });
    leave();
    // İzin ilk düzenli ödeme kaydedilirken istenir (6.5, 8.6); kayıt izinden bağımsızdır.
    await ensurePermission();
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <Controller
        control={control}
        name="movementType"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel={t('recurring.form.type')}
            value={field.value}
            onChange={changeMovementType}
            options={[
              { value: 'payment', label: t('recurring.form.payment') },
              { value: 'collection', label: t('recurring.form.collection') },
            ]}
          />
        )}
      />

      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <FormField
            ref={field.ref}
            label={t('recurring.form.title')}
            isRequired
            placeholder={t(
              movementType === 'payment'
                ? 'recurring.form.titlePlaceholderPayment'
                : 'recurring.form.titlePlaceholderCollection',
            )}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            maxLength={RECURRING_TITLE_MAX_LENGTH}
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => amountRef.current?.focus()}
          />
        )}
      />

      <Controller
        control={control}
        name="amount"
        render={({ field, fieldState }) => (
          <AmountInput
            ref={(node) => {
              field.ref(node);
              amountRef.current = node;
            }}
            label={t('transactionForm.amount')}
            isRequired
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            returnKeyType="done"
          />
        )}
      />

      <View className="gap-2">
        <AppText weight="semibold" className="text-[14px]">
          {t('recurring.form.frequency')}
        </AppText>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <ChipGroup
              layout="wrap"
              accessibilityLabel={t('recurring.form.frequency')}
              options={FREQUENCY_OPTIONS.map((value) => ({
                value,
                label: t(`recurring.frequency.${value}`),
              }))}
              isSelected={(value) => value === field.value}
              onPress={(value) => field.onChange(value)}
            />
          )}
        />
        <Controller
          control={control}
          name="interval"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <View className="flex-row items-center gap-3">
                <StepButton
                  icon="minus"
                  label={t('recurring.form.intervalDecrease')}
                  isDisabled={field.value <= 1}
                  onPress={() => field.onChange(field.value - 1)}
                  color={colors.primary}
                />
                <AppText
                  weight="bold"
                  accessibilityLiveRegion="polite"
                  className="flex-1 text-center text-[15px]"
                >
                  {t(`recurring.every.${frequency}`, { count: interval })}
                </AppText>
                <StepButton
                  icon="plus"
                  label={t('recurring.form.intervalIncrease')}
                  isDisabled={field.value >= MAX_INTERVAL}
                  onPress={() => field.onChange(field.value + 1)}
                  color={colors.primary}
                />
              </View>
              {fieldState.error ? (
                <AppText className="text-[13px] text-danger">
                  {errorText(fieldState.error.message)}
                </AppText>
              ) : null}
            </View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="dueDate"
        render={({ field, fieldState }) => (
          <DateField
            label={t(props.mode === 'new' ? 'recurring.form.firstDate' : 'recurring.form.nextDate')}
            isRequired
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="endDate"
        render={({ field, fieldState }) => (
          <DateField
            label={t('recurring.form.endDate')}
            placeholder={t('recurring.form.noEndDate')}
            isClearable
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

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

      <FormSection title={t('recurring.form.reminderSection')}>
        <Controller
          control={control}
          name="remindDaysBefore"
          render={({ field }) => (
            <View className="gap-2">
              <AppText weight="semibold" className="text-[14px]">
                {t('recurring.form.remindDaysBefore')}
              </AppText>
              <ChipGroup
                layout="wrap"
                accessibilityLabel={t('recurring.form.remindDaysBefore')}
                options={REMIND_DAYS_OPTIONS.map((days) => ({
                  value: String(days),
                  label: t('recurring.remindDays', { count: days }),
                }))}
                isSelected={(value) => Number(value) === field.value}
                onPress={(value) => field.onChange(Number(value))}
              />
            </View>
          )}
        />
        <Controller
          control={control}
          name="remindTime"
          render={({ field, fieldState }) => (
            <TimeField
              label={t('recurring.form.remindTime')}
              value={field.value}
              onChange={field.onChange}
              error={errorText(fieldState.error?.message)}
            />
          )}
        />
        <PermissionBanner />
      </FormSection>

      <FormSection title={t('transactionForm.detailsSection')}>
        <Controller
          control={control}
          name="contactId"
          render={({ field }) => (
            <PickerField
              label={t('transactionForm.contact')}
              placeholder={t('transactionForm.selectContactOptional')}
              disabledPlaceholder={t('transactionForm.noContacts')}
              value={field.value}
              options={contactOptions}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="transactionTypeId"
          render={({ field }) => (
            <PickerField
              label={t(
                direction === 'income'
                  ? 'transactionForm.incomeType'
                  : 'transactionForm.expenseType',
              )}
              placeholder={t('transactionForm.selectType')}
              value={field.value}
              options={typeOptions}
              onChange={field.onChange}
            />
          )}
        />
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
      </FormSection>
    </FormScreen>
  );
}

function StepButton({
  icon,
  label,
  isDisabled,
  onPress,
  color,
}: {
  icon: 'plus' | 'minus';
  label: string;
  isDisabled: boolean;
  onPress: () => void;
  color: string;
}) {
  const Icon = icon === 'plus' ? Plus : Minus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className={cn(
        'h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface active:opacity-70',
        isDisabled && 'opacity-40',
      )}
    >
      <Icon size={20} color={color} strokeWidth={2.4} />
    </Pressable>
  );
}
