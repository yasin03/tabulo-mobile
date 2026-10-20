import { Button, FieldError, Input, Label, TextField } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { AppText } from '@/components/ui/AppText';
import { useThemeMode } from '@/lib/theme';

export const DEFINITION_NAME_MAX_LENGTH = 60;

type NameDialogProps = {
  isOpen: boolean;
  title: string;
  label: string;
  initialValue?: string;
  onClose: () => void;
  /** Hata fırlatırsa diyalog açık kalır. */
  onSave: (name: string) => Promise<void>;
};

/** Tek alanlı ad girişi: işlem türü / konu ekle ve yeniden adlandır. Klavye açılınca yukarı kayar. */
export function NameDialog(props: NameDialogProps) {
  return (
    <Modal visible={props.isOpen} transparent animationType="fade" onRequestClose={props.onClose}>
      {/* İçerik her açılışta yeniden kurulur; böylece başlangıç değeri güncel olur. */}
      {props.isOpen ? <NameDialogBody {...props} /> : null}
    </Modal>
  );
}

function NameDialogBody({ title, label, initialValue = '', onClose, onSave }: NameDialogProps) {
  const { t } = useTranslation();
  const mode = useThemeMode();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setSaving] = useState(false);

  const save = async () => {
    const name = value.trim();
    if (!name) {
      setError(t('validation.required'));
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center px-6">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        className="absolute inset-0 bg-backdrop"
      />
      <View className="gap-4 rounded-[22px] bg-surface p-5">
        <AppText weight="extrabold" accessibilityRole="header" className="text-[18px]">
          {title}
        </AppText>
        <TextField isRequired isInvalid={!!error}>
          <Label>{label}</Label>
          <Input
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setError(undefined);
            }}
            autoFocus
            autoCapitalize="sentences"
            maxLength={DEFINITION_NAME_MAX_LENGTH}
            keyboardAppearance={mode}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            className="min-h-12 text-[15px]"
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </TextField>
        <View className="flex-row gap-3">
          <Button variant="secondary" size="lg" className="h-12 flex-1" onPress={onClose}>
            <Button.Label>{t('common.cancel')}</Button.Label>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="h-12 flex-1"
            isDisabled={isSaving}
            onPress={() => void save()}
          >
            <Button.Label>{t('common.save')}</Button.Label>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
