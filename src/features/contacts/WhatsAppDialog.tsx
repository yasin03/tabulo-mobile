import { Button, Input, Label, TextField } from 'heroui-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { AppText } from '@/components/ui/AppText';
import { whatsappUrl } from '@/core/whatsapp';
import { haptics } from '@/lib/haptics';
import { useThemeMode } from '@/lib/theme';

const MESSAGE_MAX_LENGTH = 1000;

type WhatsAppDialogProps = {
  isOpen: boolean;
  phone: string;
  /** Çeviri dosyasındaki varsayılan mesaj; gönderilmeden önce düzenlenebilir (6.7). */
  initialMessage: string;
  onClose: () => void;
};

/** WhatsApp hatırlatma mesajı: metni gösterir, düzenletir, `wa.me` bağlantısını açar. */
export function WhatsAppDialog(props: WhatsAppDialogProps) {
  return (
    <Modal visible={props.isOpen} transparent animationType="fade" onRequestClose={props.onClose}>
      {props.isOpen ? <WhatsAppDialogBody {...props} /> : null}
    </Modal>
  );
}

function WhatsAppDialogBody({ phone, initialMessage, onClose }: WhatsAppDialogProps) {
  const { t } = useTranslation();
  const mode = useThemeMode();
  const [message, setMessage] = useState(initialMessage);

  const send = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await Linking.openURL(whatsappUrl(phone, text));
      haptics.success();
      onClose();
    } catch {
      haptics.error();
      Alert.alert(t('contactDetail.whatsappFailedTitle'), t('contactDetail.whatsappFailed'));
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
          {t('contactDetail.whatsapp')}
        </AppText>
        <TextField>
          <Label>{t('contactDetail.whatsappMessageLabel')}</Label>
          <Input
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
            autoCapitalize="sentences"
            keyboardAppearance={mode}
            textAlignVertical="top"
            style={{ minHeight: 120, maxHeight: 220 }}
            className="text-[15px]"
          />
        </TextField>
        <View className="flex-row gap-3">
          <Button variant="secondary" size="lg" className="h-12 flex-1" onPress={onClose}>
            <Button.Label>{t('common.cancel')}</Button.Label>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="h-12 flex-1"
            isDisabled={!message.trim()}
            onPress={() => void send()}
          >
            <Button.Label numberOfLines={1}>{t('contactDetail.whatsappOpen')}</Button.Label>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
