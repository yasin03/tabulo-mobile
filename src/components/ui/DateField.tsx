import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, FieldError, Label } from 'heroui-native';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { isoToLocalDate, toIsoDate } from '@/core/dates';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useColors, useThemeMode } from '@/lib/theme';

type DateFieldProps = {
  label: string;
  /** `YYYY-AA-GG`; boş metin = seçilmedi. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  isRequired?: boolean;
  /** Seçimi temizleme düğmesi (isteğe bağlı tarihlerde, ör. vade). */
  isClearable?: boolean;
  minimumDate?: string;
};

/** Platformun kendi tarih seçicisi: iOS'ta alttan açılan satır içi takvim, Android'de sistem diyaloğu. */
export function DateField({
  label,
  value,
  onChange,
  placeholder,
  error,
  isRequired,
  isClearable = false,
  minimumDate,
}: DateFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const dates = useDates();
  const [isOpen, setOpen] = useState(false);
  // iOS: seçim "Bitti"ye basınca uygulanır; takvimde gezinmek değeri değiştirmez.
  const [draft, setDraft] = useState(value || toIsoDate());

  const display = value ? dates.format(value, 'full') : '';

  const open = () => {
    const initial = value || toIsoDate();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: isoToLocalDate(initial),
        mode: 'date',
        minimumDate: minimumDate ? isoToLocalDate(minimumDate) : undefined,
        onValueChange: (_event, date) => {
          haptics.selection();
          onChange(toIsoDate(date));
        },
      });
      return;
    }
    setDraft(initial);
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
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: display || placeholder || '' }}
          onPress={open}
          className={cn(
            'min-h-12 flex-1 flex-row items-center gap-2 rounded-xl border bg-field px-4 active:opacity-70',
            error ? 'border-danger' : 'border-field-border',
          )}
        >
          <CalendarDays size={20} color={colors.muted} />
          <AppText className={cn('flex-1', !display && 'text-field-placeholder')} numberOfLines={1}>
            {display || placeholder}
          </AppText>
        </Pressable>
        {isClearable && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${t('common.clear')}`}
            onPress={() => onChange('')}
            className="min-h-12 justify-center px-2 active:opacity-70"
          >
            <AppText weight="bold" className="text-primary">
              {t('common.clear')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? <FieldError isInvalid>{error}</FieldError> : null}

      {Platform.OS === 'ios' ? (
        // RN Modal: başka bir Modal'ın (ör. filtre paneli) içinden de açılabilir; HeroUI portalı onun arkasında kalırdı.
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
                value={isoToLocalDate(draft)}
                mode="date"
                display="inline"
                locale={dates.locale}
                themeVariant={mode}
                accentColor={colors.primary}
                minimumDate={minimumDate ? isoToLocalDate(minimumDate) : undefined}
                onValueChange={(_event, date) => setDraft(toIsoDate(date))}
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
