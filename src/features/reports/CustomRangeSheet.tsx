import { Button } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { DateField } from '@/components/ui/DateField';
import type { DateRange } from '@/core/dates';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

type CustomRangeSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Açılışta gösterilen aralık (ekrandaki dönem). Her açılışta `key` değiştirilerek taslak sıfırlanır. */
  initial: DateRange;
  onApply: (range: DateRange) => void;
};

/**
 * Raporlarda özel tarih aralığı: başlangıç + bitiş, "Uygula" ile geçerli olur.
 * HeroUI BottomSheet değil RN `Modal`: BottomSheet portalı `BusinessProvider`'ın dışında kalıyor (DateField ona bağlı).
 */
export function CustomRangeSheet({ isOpen, onClose, initial, onApply }: CustomRangeSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      {/* Kök düz View: SafeAreaView'ın className'i burada pencereyi doldurmuyordu, alanlar üst üste biniyordu. */}
      <View
        className="flex-1 bg-background"
        // iOS pageSheet durum çubuğunun altında açılır; Android'de tam ekran.
        style={{ paddingTop: Platform.OS === 'android' ? insets.top : 0 }}
      >
        <View className="flex-row items-center gap-2 px-5 pb-2 pt-3">
          <AppText weight="extrabold" accessibilityRole="header" className="flex-1 text-[18px]">
            {t('reports.customRange.title')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70"
          >
            <X size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View className="gap-4 px-5 pt-2">
          <DateField
            label={t('reports.customRange.from')}
            value={from}
            onChange={(next) => {
              setFrom(next);
              if (next > to) setTo(next);
            }}
          />
          <DateField
            label={t('reports.customRange.to')}
            value={to}
            minimumDate={from}
            onChange={setTo}
          />
        </View>

        <View className="px-5 pt-6">
          <Button
            variant="primary"
            size="lg"
            className="h-[52px]"
            onPress={() => {
              haptics.selection();
              onApply({ from, to });
              onClose();
            }}
          >
            <Button.Label className="text-[16px]">{t('reports.customRange.apply')}</Button.Label>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
