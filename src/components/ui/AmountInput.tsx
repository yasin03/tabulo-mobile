import { FieldError, InputGroup, Label, TextField, type InputProps } from 'heroui-native';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { CURRENCY_SYMBOLS, parseAmount } from '@/core/money';
import { useMoney } from '@/lib/business';
import { useThemeMode } from '@/lib/theme';

import { useSystemDoneFocus } from './formKeyboard';

type AmountInputProps = Omit<InputProps, 'value' | 'onChangeText' | 'keyboardType'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  isRequired?: boolean;
};

/**
 * Tutar girişi (6.1): sayısal klavye, büyük punto, para birimi simgesi (TR'de sonda, EN'de başta).
 * 2'den fazla ondalık basamak veya sınırı aşan tutar yazılamaz; ayrıştırma money.ts ile yapılır.
 */
export const AmountInput = forwardRef<TextInput, AmountInputProps>(function AmountInput(
  { label, value, onChangeText, error, isRequired, ...inputProps },
  ref,
) {
  const mode = useThemeMode();
  const { currency, language } = useMoney();
  const focusHandlers = useSystemDoneFocus({ ...inputProps, keyboardType: 'decimal-pad' });
  const symbol = (
    <AppText weight="extrabold" className="text-[22px] leading-[28px] text-muted">
      {CURRENCY_SYMBOLS[currency]}
    </AppText>
  );

  const handleChange = (text: string) => {
    if (text !== '' && !/^[0-9.,\s]*$/.test(text)) return;
    const parsed = parseAmount(text, language);
    // Yazarken ara durumlara (ör. "12,") izin ver; yalnızca kesin hatalı girişi engelle.
    if (!parsed.ok && (parsed.error === 'tooManyDecimals' || parsed.error === 'tooLarge')) return;
    onChangeText(text);
  };

  return (
    <TextField isRequired={isRequired} isInvalid={!!error}>
      <Label>{label}</Label>
      <InputGroup>
        {language === 'en' ? (
          <InputGroup.Prefix className="pl-4">{symbol}</InputGroup.Prefix>
        ) : null}
        <InputGroup.Input
          ref={ref}
          value={value}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          inputMode="decimal"
          keyboardAppearance={mode}
          placeholder="0"
          className="min-h-14 font-extrabold text-[24px]"
          maxFontSizeMultiplier={1.6}
          {...inputProps}
          {...focusHandlers}
        />
        {language === 'tr' ? (
          <InputGroup.Suffix className="pr-4">{symbol}</InputGroup.Suffix>
        ) : null}
      </InputGroup>
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
});
