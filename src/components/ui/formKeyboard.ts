import { createContext, useContext } from 'react';
import { Platform, type TextInputProps } from 'react-native';

/**
 * iOS 26+ sayısal klavyelerin üstüne kendi "Done" düğmesini koyar (kapatılamaz). Böyle bir alan odaktayken
 * FormScreen araç çubuğundaki "Bitti"yi gizler; iki ayrı kapatma düğmesi görünmez.
 */
const SYSTEM_DONE_KEYBOARDS: readonly TextInputProps['keyboardType'][] = [
  'decimal-pad',
  'number-pad',
];

const hasSystemDoneKeyboard =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

export const FormKeyboardContext = createContext<((systemDone: boolean) => void) | null>(null);

/** Alanın odak olaylarını sarar: odaktaki klavyenin sistem "Done" düğmesi olup olmadığını FormScreen'e bildirir. */
export function useSystemDoneFocus({
  keyboardType,
  onFocus,
  onBlur,
}: Pick<TextInputProps, 'keyboardType' | 'onFocus' | 'onBlur'>) {
  const setSystemDone = useContext(FormKeyboardContext);
  const systemDone = hasSystemDoneKeyboard && SYSTEM_DONE_KEYBOARDS.includes(keyboardType);
  return {
    onFocus: (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setSystemDone?.(systemDone);
      onFocus?.(event);
    },
    onBlur: (event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setSystemDone?.(false);
      onBlur?.(event);
    },
  };
}
