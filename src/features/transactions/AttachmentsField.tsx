import { Camera, FileText, Image as ImageIcon, Paperclip } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ActionSheet } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import type { Attachment } from '@/db';
import { usePremiumGate } from '@/lib/premium';
import { useColors } from '@/lib/theme';
import {
  attachmentKind,
  resolveAttachmentUri,
  type PendingAttachment,
} from '@/platform/attachments';

import { AttachmentThumb, THUMB_SIZE } from './AttachmentThumb';
import { useAttachmentPicker, type AttachmentSource } from './useAttachmentPicker';

type AttachmentsFieldProps = {
  /** Kayıtlı belgeler (düzenlemede; kaldırılanlar hariç). */
  existing: readonly Attachment[];
  /** Bu formda seçilen, henüz kaydedilmemiş belgeler. */
  pending: readonly PendingAttachment[];
  onAdd: (items: PendingAttachment[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (id: string) => void;
};

/**
 * Belgeler (6.4): fotoğraf çek / galeriden seç / PDF seç; birden fazla. Yeni belge eklemek Premium (6.8);
 * kayıtlı belgeler ücretsiz planda da görünür ve kaldırılabilir.
 */
export function AttachmentsField({
  existing,
  pending,
  onAdd,
  onRemoveExisting,
  onRemovePending,
}: AttachmentsFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const pick = useAttachmentPicker();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const requirePremium = usePremiumGate();

  const add = async (source: AttachmentSource) => {
    const items = await pick(source);
    if (items.length > 0) onAdd(items);
  };

  return (
    <View className="gap-2">
      <AppText weight="semibold" className="text-[14px]">
        {t('attachments.title')}
      </AppText>
      <View className="flex-row flex-wrap gap-3 pt-1.5">
        {existing.map((item) => (
          <AttachmentThumb
            key={item.id}
            uri={resolveAttachmentUri(item.fileUri)}
            kind={attachmentKind(item.mimeType)}
            fileName={item.fileName}
            onRemove={() => onRemoveExisting(item.id)}
          />
        ))}
        {pending.map((item) => (
          <AttachmentThumb
            key={item.id}
            uri={item.uri}
            kind={item.kind}
            fileName={item.fileName}
            onRemove={() => onRemovePending(item.id)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('attachments.add')}
          onPress={() => {
            if (requirePremium('attachments')) setMenuOpen(true);
          }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          className="items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface active:opacity-70"
        >
          <Paperclip size={22} color={colors.primary} />
          <AppText
            weight="semibold"
            maxFontSizeMultiplier={1.2}
            className="text-center text-[11px] leading-[14px] text-primary"
          >
            {t('attachments.add')}
          </AppText>
        </Pressable>
      </View>

      <ActionSheet
        isOpen={isMenuOpen}
        onOpenChange={setMenuOpen}
        title={t('attachments.add')}
        items={[
          {
            key: 'camera',
            label: t('attachments.takePhoto'),
            icon: Camera,
            onPress: () => void add('camera'),
          },
          {
            key: 'library',
            label: t('attachments.chooseFromLibrary'),
            icon: ImageIcon,
            onPress: () => void add('library'),
          },
          {
            key: 'pdf',
            label: t('attachments.choosePdf'),
            icon: FileText,
            onPress: () => void add('pdf'),
          },
        ]}
      />
    </View>
  );
}
