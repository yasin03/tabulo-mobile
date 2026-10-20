import { Bell, MessageCircle, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { MoneyText } from '@/components/ui/MoneyText';
import { toIsoDate } from '@/core/dates';
import { balanceState, type DueInfo } from '@/core/ledger';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

type ContactBalanceCardProps = {
  balanceMinor: number;
  due: DueInfo | null;
  hasPhone: boolean;
  onSendStatement: () => void;
  onRemind: () => void;
  onWhatsApp: () => void;
};

/**
 * Cari detayındaki bakiye kartı (7.4, client-detail.html): "Size borçlu / Borcunuz / Hesap kapalı",
 * en yakın açık vade (FIFO), Ekstre gönder, Hatırlat ve WhatsApp mesajı.
 */
export function ContactBalanceCard({
  balanceMinor,
  due,
  hasPhone,
  onSendStatement,
  onRemind,
  onWhatsApp,
}: ContactBalanceCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDates();
  const state = balanceState(balanceMinor);
  const isOverdue = due ? due.dueDate < toIsoDate() : false;

  return (
    <View className="gap-[14px] rounded-[22px] border border-border bg-surface p-[18px]">
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <View className="gap-1">
          <AppText className="text-[13px] leading-[18px] text-muted">
            {t(`contactDetail.balance.${state}`)}
          </AppText>
          <MoneyText
            minor={balanceMinor}
            signed
            accessibilityRole="header"
            className="text-[32px] leading-[40px] tracking-[-0.6px]"
          />
        </View>
        {due ? (
          <View
            className={cn(
              'rounded-full px-[10px] py-[5px]',
              isOverdue ? 'border border-negative' : 'bg-warning-bg',
            )}
          >
            <AppText
              weight="bold"
              maxFontSizeMultiplier={1.4}
              className={cn(
                'text-[12px] leading-[16px]',
                isOverdue ? 'text-negative' : 'text-warning-fg',
              )}
            >
              {t(isOverdue ? 'contactDetail.overdue' : 'contactDetail.due', {
                date: dates.format(due.dueDate, 'dayMonthLong'),
              })}
            </AppText>
          </View>
        ) : null}
      </View>

      <View className="flex-row gap-[10px]">
        <Pressable
          accessibilityRole="button"
          onPress={onSendStatement}
          className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-[14px] bg-primary px-3 active:opacity-80"
        >
          <Send size={18} color={colors['primary-foreground']} strokeWidth={2} />
          <AppText
            weight="bold"
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            className="shrink text-primary-foreground"
          >
            {t('contactDetail.sendStatement')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onRemind}
          className="min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-[14px] border-2 border-accent bg-surface px-3 active:opacity-80"
        >
          <Bell size={18} color={colors['warning-fg']} strokeWidth={2} />
          <AppText weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.4} className="shrink">
            {t('contactDetail.remind')}
          </AppText>
        </Pressable>
      </View>
      {hasPhone ? (
        <Pressable
          accessibilityRole="button"
          onPress={onWhatsApp}
          className="min-h-11 flex-row items-center justify-center gap-2 rounded-[14px] active:bg-surface-secondary"
        >
          <MessageCircle size={18} color={colors.primary} strokeWidth={2} />
          <AppText weight="bold" className="text-primary">
            {t('contactDetail.whatsapp')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
