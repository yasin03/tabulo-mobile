import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, FieldError, Label } from 'heroui-native';
import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { formatTimeOfDay, localDateTime, toIsoDate, toTimeOfDay } from '@/core/dates';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useColors, useThemeMode } from '@/lib/theme';

type TimeFieldProps = {
  label: string;
  /** `SS:DD` (24 saat). */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  isRequired?: boolean;
};

/** Saat seçimi (hatırlatma saati): iOS'ta alttan açılan çark, Android'de sistem saat diyaloğu. */
export function TimeField({ label, value, onChange, error, isRequired }: TimeFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const { locale } = useDates();
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const asDate = (time: string) => localDateTime(toIsoDate(), time);
  const display = value ? formatTimeOfDay(value, locale) : '';
  const is24Hour = !new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: asDate(value || '09:00'),
        mode: 'time',
        is24Hour,
        onValueChange: (_event, date) => {
          haptics.selection();
          onChange(toTimeOfDay(date));
        },
      });
      return;
    }
    setDraft(value || '09:00');
    setOpen(true);
  };

  const apply = () => {
    haptics.selection();
    onChange(draft);
    setOpen(false);
  };

  return (
    <View className="gap-1.5">
      <Label isInvalid={!!error} isRequired={isRequired}>
        {label}
      </Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        onPress={open}
        className={cn(
          'min-h-12 flex-row items-center gap-2 rounded-xl border bg-field px-4 active:opacity-70',
          error ? 'border-danger' : 'border-field-border',
        )}
      >
        <Clock size={20} color={colors.muted} />
        <AppText className="flex-1" numberOfLines={1}>
          {display}
        </AppText>
      </Pressable>
      {error ? <FieldError isInvalid>{error}</FieldError> : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={isOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <View className="flex-1 justify-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setOpen(false)}
              className="absolute inset-0 bg-backdrop"
            />
            <View
              className="gap-3 rounded-t-[22px] bg-surface px-5 pt-5"
              style={{ paddingBottom: insets.bottom + 12 }}
            >
              <AppText weight="extrabold" accessibilityRole="header" className="text-[18px]">
                {label}
              </AppText>
              <DateTimePicker
                value={asDate(draft)}
                mode="time"
                display="spinner"
                locale={locale}
                themeVariant={mode}
                onValueChange={(_event, date) => setDraft(toTimeOfDay(date))}
                style={{ alignSelf: 'center' }}
              />
              <Button variant="primary" size="lg" className="h-[52px]" onPress={apply}>
                <Button.Label className="text-[16px]">{t('common.done')}</Button.Label>
              </Button>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
