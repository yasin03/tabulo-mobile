import { FieldError, Input, Label, TextField, type InputProps } from 'heroui-native';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';

import { useThemeMode } from '@/lib/theme';

import { useSystemDoneFocus } from './formKeyboard';

type FormFieldProps = InputProps & {
  label: string;
  error?: string;
  isRequired?: boolean;
};

const MULTILINE_STYLE = { minHeight: 96, paddingTop: 12, paddingBottom: 12 };

/** Etiket + giriş + hata mesajı. iOS klavye görünümü temaya uyar (4.4). */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, isRequired, className, style, ...inputProps },
  ref,
) {
  const mode = useThemeMode();
  const focusHandlers = useSystemDoneFocus(inputProps);
  return (
    <TextField isRequired={isRequired} isInvalid={!!error}>
      <Label>{label}</Label>
      <Input
        ref={ref}
        keyboardAppearance={mode}
        className={className ?? 'min-h-12 text-[15px]'}
        // HeroUI'nin .input__input min-height'ı Tailwind min-h-* sınıfını ezdiği için çok satırlı alanda style ile.
        style={[inputProps.multiline && MULTILINE_STYLE, style]}
        {...inputProps}
        {...focusHandlers}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
});
