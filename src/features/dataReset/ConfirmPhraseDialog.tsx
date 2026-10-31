import { Button, Input, Label, Spinner, TextField } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { AppText } from '@/components/ui/AppText';
import { matchesConfirmPhrase } from '@/core/dataReset';
import { useDates } from '@/lib/dates';
import { useColors, useThemeMode } from '@/lib/theme';

type ConfirmPhraseDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  /** Yazılması gereken ifade ("Verileri Sil"). */
  phrase: string;
  confirmLabel: string;
  onClose: () => void;
  /** Hata fırlatırsa diyalog açık kalır. */
  onConfirm: () => Promise<void>;
};

/** Yazarak onay: ifade birebir yazılmadan (büyük/küçük harf önemsiz) onay düğmesi açılmaz. */
export function ConfirmPhraseDialog(props: ConfirmPhraseDialogProps) {
  return (
    <Modal visible={props.isOpen} transparent animationType="fade" onRequestClose={props.onClose}>
      {/* İçerik her açılışta yeniden kurulur; böylece alan boş başlar. */}
      {props.isOpen ? <ConfirmPhraseBody {...props} /> : null}
    </Modal>
  );
}

function ConfirmPhraseBody({
  title,
  description,
  phrase,
  confirmLabel,
  onClose,
  onConfirm,
}: ConfirmPhraseDialogProps) {
  const { t } = useTranslation();
  const mode = useThemeMode();
  const colors = useColors();
  const { locale } = useDates();
  const [value, setValue] = useState('');
  const [isWorking, setWorking] = useState(false);
  const matches = matchesConfirmPhrase(value, phrase, locale);

  const confirm = async () => {
    if (!matches || isWorking) return;
    setWorking(true);
    try {
      await onConfirm();
    } catch {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center px-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={isWorking ? undefined : onClose}
        className="absolute inset-0 bg-backdrop"
      />
      <View className="gap-4 rounded-[22px] bg-surface p-5">
        <AppText weight="extrabold" accessibilityRole="header" className="text-[18px]">
          {title}
        </AppText>
        <AppText className="text-[14px] leading-[20px] text-muted">{description}</AppText>
        <TextField>
          <Label>{t('dataReset.typeLabel', { phrase })}</Label>
          <Input
            value={value}
            onChangeText={setValue}
            placeholder={phrase}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance={mode}
            returnKeyType="done"
            onSubmitEditing={() => void confirm()}
            editable={!isWorking}
            className="min-h-12 text-[15px]"
          />
        </TextField>
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="h-12 flex-1"
            isDisabled={isWorking}
            onPress={onClose}
          >
            <Button.Label>{t('common.cancel')}</Button.Label>
          </Button>
          <Button
            variant="danger-soft"
            size="lg"
            className="h-12 flex-1"
            isDisabled={!matches || isWorking}
            onPress={() => void confirm()}
          >
            {isWorking ? <Spinner color={colors.negative} /> : null}
            <Button.Label>{confirmLabel}</Button.Label>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
