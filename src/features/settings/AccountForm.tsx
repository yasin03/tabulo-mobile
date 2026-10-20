import { useToast } from 'heroui-native';
import { useMemo, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View, type TextInput } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  createAccountFormSchema,
  type AccountFormOutput,
  type AccountFormValues,
} from '@/core/forms/account';
import { accountsRepo } from '@/db';
import { useMoney } from '@/lib/business';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';

import { useAccountLimit } from './useAccountActions';

type AccountFormProps =
  | { mode: 'new'; initialValues: AccountFormValues; accountId?: undefined; isActive?: undefined }
  | { mode: 'edit'; initialValues: AccountFormValues; accountId: string; isActive: boolean };

/** Hesap ekle / düzenle (7.11): Kasa / Banka, ad, banka adı, IBAN, açılış bakiyesi. */
export function AccountForm({ mode, initialValues, accountId, isActive }: AccountFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { language, currency } = useMoney();
  const ensureCanAdd = useAccountLimit();

  const schema = useMemo(() => createAccountFormSchema({ language }), [language]);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<AccountFormValues, unknown, AccountFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  const leave = useConfirmDiscard(isDirty);
  const type = useWatch({ control, name: 'type' });

  const bankNameRef = useRef<TextInput>(null);
  const ibanRef = useRef<TextInput>(null);
  const openingRef = useRef<TextInput>(null);

  const save = async (output: AccountFormOutput) => {
    // Yeni hesap veya aktif hesabın türü değişince ücretsiz sınır (1 kasa + 1 banka) kontrol edilir.
    const typeChanged = mode === 'edit' && isActive && output.type !== initialValues.type;
    if ((mode === 'new' || typeChanged) && !(await ensureCanAdd(output.type))) return;
    try {
      if (mode === 'new') await accountsRepo.create({ ...output, currency });
      else await accountsRepo.update(accountId, output);
      haptics.success();
      toast.show({ variant: 'success', label: t('accounts.saved') });
      leave();
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
    }
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel={t('accounts.type')}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'cash', label: t('accountTypes.cash') },
              { value: 'bank', label: t('accountTypes.bank') },
            ]}
          />
        )}
      />

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            ref={field.ref}
            label={t('accounts.name')}
            isRequired
            placeholder={t(
              type === 'bank' ? 'accounts.namePlaceholderBank' : 'accounts.namePlaceholderCash',
            )}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            maxLength={ACCOUNT_NAME_MAX_LENGTH}
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => (type === 'bank' ? bankNameRef : openingRef).current?.focus()}
          />
        )}
      />

      {type === 'bank' ? (
        <>
          <Controller
            control={control}
            name="bankName"
            render={({ field }) => (
              <FormField
                ref={bankNameRef}
                label={t('accounts.bankName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => ibanRef.current?.focus()}
              />
            )}
          />
          <Controller
            control={control}
            name="iban"
            render={({ field, fieldState }) => (
              <View className="gap-1">
                <FormField
                  ref={(node) => {
                    field.ref(node);
                    ibanRef.current = node;
                  }}
                  label={t('accounts.iban')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={errorText(fieldState.error?.message)}
                  placeholder={language === 'tr' ? 'TR00 0000 0000 0000 0000 0000 00' : undefined}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={42}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => openingRef.current?.focus()}
                />
                {fieldState.error ? null : (
                  <AppText className="text-[12px] leading-[17px] text-muted">
                    {t('accounts.ibanHint')}
                  </AppText>
                )}
              </View>
            )}
          />
        </>
      ) : null}

      <Controller
        control={control}
        name="openingBalance"
        render={({ field, fieldState }) => (
          <View className="gap-1">
            <AmountInput
              ref={(node) => {
                field.ref(node);
                openingRef.current = node;
              }}
              label={t('accounts.openingBalance')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            {fieldState.error ? null : (
              <AppText className="text-[12px] leading-[17px] text-muted">
                {t('accounts.openingHint')}
              </AppText>
            )}
          </View>
        )}
      />
    </FormScreen>
  );
}
