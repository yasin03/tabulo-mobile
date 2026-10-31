import { Button, Spinner } from 'heroui-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colorTokens } from '@/core/theme/tokens';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

import { FormKeyboardContext } from './formKeyboard';

/** react-native-keyboard-controller KeyboardToolbar yüksekliği. */
const KEYBOARD_TOOLBAR_HEIGHT = 42;
const FOOTER_PADDING = 12;
const BUTTON_HEIGHT = 52;
const FOOTER_HEIGHT = FOOTER_PADDING * 2 + BUTTON_HEIGHT;

const TOOLBAR_THEME = {
  light: {
    primary: colorTokens.light.primary,
    disabled: colorTokens.light.border,
    background: colorTokens.light.surface,
    ripple: colorTokens.light['surface-secondary'],
  },
  dark: {
    primary: colorTokens.dark.primary,
    disabled: colorTokens.dark.border,
    background: colorTokens.dark.surface,
    ripple: colorTokens.dark['surface-secondary'],
  },
};

type FormScreenProps = {
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  contentClassName?: string;
};

/**
 * Tüm formların ortak iskeleti (PROMPT.md 8.1):
 * - KeyboardAwareScrollView: odaklanan alan her zaman klavyenin ve araç çubuğunun üstünde kalır.
 * - KeyboardToolbar: önceki / sonraki / bitti. iOS 26+ sayısal klavyede sistemin kendi "Done"u olduğu için
 *   o alan odaktayken "Bitti" gizlenir (formKeyboard.ts).
 * - Kaydet butonu altta sabittir; klavye açıkken onun arkasında kalır (form alanı daralmasın diye,
 *   kullanıcı kararı). Klavye "Bitti" ile kapanınca görünür.
 */
export function FormScreen({
  children,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  isSubmitDisabled = false,
  contentClassName,
}: FormScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [systemDone, setSystemDone] = useState(false);
  const footerBottomPadding = Math.max(insets.bottom, FOOTER_PADDING);

  return (
    <FormKeyboardContext.Provider value={setSystemDone}>
      <View className="flex-1 bg-background">
        <KeyboardAwareScrollView
          bottomOffset={KEYBOARD_TOOLBAR_HEIGHT + 16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerClassName={cn('gap-4 px-5 pt-4', contentClassName)}
          contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + footerBottomPadding + 16 }}
        >
          {children}
        </KeyboardAwareScrollView>

        <View
          className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-5"
          style={{ paddingTop: FOOTER_PADDING, paddingBottom: footerBottomPadding }}
        >
          <Button
            variant="primary"
            size="lg"
            className="h-[52px]"
            onPress={onSubmit}
            isDisabled={isSubmitting || isSubmitDisabled}
            accessibilityState={{ busy: isSubmitting }}
          >
            {isSubmitting ? (
              <Spinner color={colors['accent-foreground']} />
            ) : (
              <Button.Label className="text-[16px]">{submitLabel ?? t('common.save')}</Button.Label>
            )}
          </Button>
        </View>

        <KeyboardToolbar theme={TOOLBAR_THEME}>
          <KeyboardToolbar.Prev />
          <KeyboardToolbar.Next />
          {systemDone ? null : <KeyboardToolbar.Done text={t('common.done')} />}
        </KeyboardToolbar>
      </View>
    </FormKeyboardContext.Provider>
  );
}
