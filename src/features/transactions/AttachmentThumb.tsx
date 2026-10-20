import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FileText, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/lib/theme';
import { openWithSystem, type AttachmentKind } from '@/platform/attachments';

export const THUMB_SIZE = 84;

type AttachmentThumbProps = {
  /** Açılabilir `file://` adresi. */
  uri: string;
  kind: AttachmentKind;
  fileName: string | null;
  onRemove?: () => void;
};

/** Belge önizlemesi: fotoğrafa dokununca tam ekran, PDF'e dokununca sistemin önizleme/paylaş ekranı (7.7). */
export function AttachmentThumb({ uri, kind, fileName, onRemove }: AttachmentThumbProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const label = fileName ?? t(kind === 'pdf' ? 'attachments.pdf' : 'attachments.photo');

  const open = () => {
    if (kind === 'pdf') {
      void openWithSystem(uri, 'application/pdf');
      return;
    }
    router.push({ pathname: '/attachment-viewer', params: { uri, title: label } });
  };

  return (
    <View style={{ width: THUMB_SIZE, height: THUMB_SIZE }}>
      <Pressable
        accessibilityRole={kind === 'pdf' ? 'button' : 'imagebutton'}
        accessibilityLabel={label}
        accessibilityHint={t('attachments.openHint')}
        onPress={open}
        className="flex-1 overflow-hidden rounded-xl border border-border bg-surface-secondary active:opacity-70"
      >
        {kind === 'image' ? (
          <Image
            source={{ uri }}
            style={{ flex: 1 }}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-1 px-1.5">
            <FileText size={26} color={colors.primary} />
            <AppText
              numberOfLines={2}
              maxFontSizeMultiplier={1.2}
              className="text-center text-[10px] leading-[13px] text-muted"
            >
              {label}
            </AppText>
          </View>
        )}
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('attachments.remove', { name: label })}
          onPress={onRemove}
          hitSlop={10}
          className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
        >
          <X size={14} color={colors.foreground} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}
