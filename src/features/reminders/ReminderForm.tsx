import { router, Stack } from 'expo-router';
import { useToast } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { DateField } from '@/components/ui/DateField';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { TimeField } from '@/components/ui/TimeField';
import { toIsoDate, toTimeOfDay } from '@/core/dates';
import {
  createReminderFormSchema,
  REMINDER_NOTE_MAX_LENGTH,
  type ReminderFormOutput,
  type ReminderFormValues,
} from '@/core/forms/reminder';
import { remindersRepo, type Contact } from '@/db';
import { ContactAvatar } from '@/features/contacts/ContactAvatar';
import { PermissionBanner } from '@/features/notifications/PermissionBanner';
import { useEnsureNotificationPermission } from '@/features/notifications/useNotificationPermission';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';

type ReminderFormProps = {
  contact: Pick<Contact, 'id' | 'name' | 'personType'>;
  initialValues: ReminderFormValues;
} & ({ mode: 'new' } | { mode: 'edit'; reminderId: string });

/** Tahsilat hatırlatıcısı (6.6): tarih + saat + not; o zaman yerel bildirim gelir, dokununca cari açılır. */
export function ReminderForm(props: ReminderFormProps) {
  const { contact, initialValues } = props;
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const ensurePermission = useEnsureNotificationPermission();

  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<ReminderFormValues, unknown, ReminderFormOutput>({
    defaultValues: initialValues,
    // Şimdiki zaman doğrulama anında alınır (form uzun süre açık kalabilir).
    resolver: (values, context, options) =>
      zodResolver(createReminderFormSchema({ now: { date: toIsoDate(), time: toTimeOfDay() } }))(
        values,
        context,
        options,
      ),
    shouldFocusError: true,
  });
  const leave = useConfirmDiscard(isDirty);
  const today = useMemo(() => toIsoDate(), []);

  const save = async (output: ReminderFormOutput) => {
    try {
      if (props.mode === 'new') await remindersRepo.create({ contactId: contact.id, ...output });
      else await remindersRepo.update(props.reminderId, output);
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      return;
    }
    haptics.success();
    toast.show({ variant: 'success', label: t('reminders.saved') });
    leave();
    await ensurePermission();
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <Stack.Screen
        options={{
          title: t(props.mode === 'new' ? 'reminders.newTitle' : 'reminders.editTitle'),
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

      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-4">
        <ContactAvatar name={contact.name} personType={contact.personType} />
        <View className="flex-1 gap-0.5">
          <AppText className="text-[12px] leading-[17px] text-muted">
            {t('reminders.contact')}
          </AppText>
          <AppText weight="bold" numberOfLines={2}>
            {contact.name}
          </AppText>
        </View>
      </View>

      <Controller
        control={control}
        name="remindDate"
        render={({ field, fieldState }) => (
          <DateField
            label={t('reminders.date')}
            isRequired
            value={field.value}
            onChange={field.onChange}
            minimumDate={today}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="remindTime"
        render={({ field, fieldState }) => (
          <TimeField
            label={t('reminders.time')}
            isRequired
            value={field.value}
            onChange={field.onChange}
            error={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        control={control}
        name="note"
        render={({ field, fieldState }) => (
          <FormField
            ref={field.ref}
            label={t('reminders.note')}
            placeholder={t('reminders.notePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            maxLength={REMINDER_NOTE_MAX_LENGTH}
            autoCapitalize="sentences"
            multiline
          />
        )}
      />

      <PermissionBanner />
    </FormScreen>
  );
}
