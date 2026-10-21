import { FieldError, Label, SearchField } from 'heroui-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { matchesSearch } from '@/core/text';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

export type PickerOption = {
  value: string;
  label: string;
  /** Satırın altında ikincil metin (ör. il / bakiye). Aramaya dahildir. */
  description?: string;
};

/** Değeri ve etiketi aynı olan basit liste (il / ilçe). */
export function textOptions(values: readonly string[]): PickerOption[] {
  return values.map((value) => ({ value, label: value }));
}

type PickerFieldProps = {
  label: string;
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  /** Liste boşken (ör. il seçilmeden ilçe) gösterilecek metin; alan devre dışı kalır. */
  disabledPlaceholder?: string;
  error?: string;
  isRequired?: boolean;
  /** Seçimi temizleme düğmesi (zorunlu alanlarda kapatılır). Varsayılan açık. */
  isClearable?: boolean;
};

/** Uzun listelerden aranarak seçim (il / ilçe, cari, işlem türü). Dokununca tam ekran arama listesi açılır. */
export function PickerField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabledPlaceholder,
  error,
  isRequired,
  isClearable = true,
}: PickerFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isOpen, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const isDisabled = options.length === 0;

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered = useMemo(
    () =>
      search.trim()
        ? options.filter((o) => matchesSearch(search, o.label, o.description))
        : options,
    [options, search],
  );

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const select = (option: string) => {
    haptics.selection();
    onChange(option);
    close();
  };

  return (
    <View className="gap-1.5">
      <Label isInvalid={!!error} isRequired={isRequired}>
        {label}
      </Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selectedLabel || placeholder }}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={() => setOpen(true)}
        className={cn(
          'min-h-12 flex-row items-center gap-2 rounded-xl border bg-field px-4 active:opacity-70',
          error ? 'border-danger' : 'border-field-border',
          isDisabled && 'opacity-50',
        )}
      >
        <AppText
          className={cn('flex-1', !selectedLabel && 'text-field-placeholder')}
          numberOfLines={1}
        >
          {selectedLabel || (isDisabled ? (disabledPlaceholder ?? placeholder) : placeholder)}
        </AppText>
        <ChevronDown size={20} color={colors.muted} />
      </Pressable>
      {error ? <FieldError isInvalid>{error}</FieldError> : null}

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={close}
      >
        {/* Kök düz View: SafeAreaView'ın className'i Modal içinde uygulanmıyor (zemin, flex-1). */}
        <View
          className="flex-1 bg-background"
          style={{
            // iOS pageSheet durum çubuğunun altında açılır; Android'de tam ekran.
            paddingTop: Platform.OS === 'android' ? insets.top : 0,
            paddingBottom: insets.bottom,
          }}
        >
          <View className="flex-row items-center gap-2 px-5 pb-2 pt-3">
            <AppText weight="extrabold" accessibilityRole="header" className="flex-1 text-[18px]">
              {label}
            </AppText>
            {value && isClearable ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => select('')}
                className="min-h-11 justify-center px-2 active:opacity-70"
              >
                <AppText weight="bold" className="text-primary">
                  {t('common.clear')}
                </AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={close}
              className="h-11 w-11 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70"
            >
              <X size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <View className="px-5 pb-3">
            <SearchField value={search} onChange={setSearch}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={t('picker.searchPlaceholder')}
                  autoCorrect={false}
                  returnKeyType="search"
                  className="min-h-12"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerClassName="px-5 pb-6"
            initialNumToRender={20}
            ListEmptyComponent={
              <AppText className="py-8 text-center text-muted">{t('picker.noResults')}</AppText>
            }
            renderItem={({ item, index }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => select(item.value)}
                  className={cn(
                    'min-h-[52px] flex-row items-center gap-3 border-separator px-1 py-2 active:bg-surface-secondary',
                    index > 0 && 'border-t',
                  )}
                >
                  <View className="flex-1 gap-0.5">
                    <AppText weight={selected ? 'bold' : 'normal'}>{item.label}</AppText>
                    {item.description ? (
                      <AppText className="text-[12px] leading-[17px] text-muted">
                        {item.description}
                      </AppText>
                    ) : null}
                  </View>
                  {selected ? <Check size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
