import { router, Stack } from 'expo-router';
import { useToast } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { FormScreen } from '@/components/ui/FormScreen';
import {
  createPaymentFormSchema,
  type PaymentFormOutput,
  type PaymentFormValues,
} from '@/core/forms/recurring';
import { recurringPaymentsRepo, type Account } from '@/db';
import type { RecurringPaymentListItem } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';
import { usePreferences } from '@/stores/preferences';

import { DueLabel } from './DueLabel';

type PaymentFormProps = {
  recurring: RecurringPaymentListItem;
  accounts: readonly Account[];
  initialValues: PaymentFormValues;
  today: string;
};

/**
 * "Ödendi" (6.5): tutar, tarih ve hesap ödeme anında düzenlenebilir. Kaydedince hareket oluşur, sonraki
 * tarih ileri alınır ve bildirim yeniden kurulur; 5 sn "Geri al".
 */
export function PaymentForm({ recurring, accounts, initialValues, today }: PaymentFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const dates = useDates();
  const { language } = useMoney();
  const setLastAccountId = usePreferences((s) => s.setLastAccountId);

  const schema = useMemo(() => createPaymentFormSchema({ language }), [language]);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<PaymentFormValues, unknown, PaymentFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  const leave = useConfirmDiscard(isDirty);

  const accountOptions = accounts
    .filter((a) => a.status === 'active')
    .map((a) => ({ value: a.id, label: a.name }));

  const save = async (output: PaymentFormOutput) => {
    try {
      const result = await recurringPaymentsRepo.markPaid(recurring.id, output);
      setLastAccountId(output.accountId);
      haptics.success();
      toast.show({
        variant: 'success',
        label: result.isFinished
          ? t('recurring.paidFinished')
          : t('recurring.paid', { date: dates.format(result.nextDueDate, 'dayMonthLong') }),
        actionLabel: t('common.undo'),
        duration: 5000,
        onActionPress: ({ hide }) => {
          void recurringPaymentsRepo.undoPaid(recurring.id, result);
          hide();
        },
      });
      leave();
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
    }
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen
      onSubmit={submit}
      isSubmitting={isSubmitting}
      submitLabel={t(`recurring.pay.${recurring.movementType}Submit`)}
    >
      <Stack.Screen
        options={{
          title: t(`recurring.pay.${recurring.movementType}Title`),
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

      <View className="gap-1.5 rounded-[18px] border border-border bg-surface p-4">
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[18px] leading-[24px]"
        >
          {recurring.title}
        </AppText>
        <AppText className="text-[13px] leading-[18px] text-muted">
          {[
            t('recurring.dueOn', { date: dates.format(recurring.nextDueDate, 'full') }),
            recurring.contactName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        <DueLabel nextDueDate={recurring.nextDueDate} today={today} />
      </View>

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
            returnKeyType="done"
          />
        )}
      />

      <Controller
        control={control}
        name="date"
        render={({ field, fieldState }) => (
          <DateField
            label={t(`recurring.pay.${recurring.movementType}Date`)}
            isRequired
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

      <AppText className="text-[13px] leading-[19px] text-muted">
        {t(`recurring.pay.${recurring.movementType}Hint`)}
      </AppText>
    </FormScreen>
  );
}
