import { Chip } from 'heroui-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { MoneyText } from '@/components/ui/MoneyText';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import type { ContactWithBalance } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';

import { ContactAvatar } from './ContactAvatar';

type ContactRowProps = {
  contact: ContactWithBalance;
  isFirst: boolean;
  isLast: boolean;
  onPress: (contact: ContactWithBalance) => void;
  onLongPress: (contact: ContactWithBalance) => void;
  onEdit: (contact: ContactWithBalance) => void;
  onDelete: (contact: ContactWithBalance) => void;
  onToggleStatus: (contact: ContactWithBalance) => void;
};

/**
 * Cari satırı (7.3): avatar, ad, il/ilçe, sağda bakiye (+/−).
 * Sola kaydır → Sil, sağa kaydır → Düzenle; aynı eylemler uzun basınca da açılır (8.3).
 */
export const ContactRow = memo(function ContactRow({
  contact,
  isFirst,
  isLast,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
  onToggleStatus,
}: ContactRowProps) {
  const { t } = useTranslation();
  const money = useMoney();
  const isPassive = contact.status === 'passive';

  const location = [contact.district, contact.city].filter(Boolean).join(', ');
  const subtitle = location || t(`contactRoles.${contact.role}`);
  const balanceLabel =
    contact.balanceMinor > 0
      ? t('contacts.balanceReceivable', { amount: money.format(contact.balanceMinor) })
      : contact.balanceMinor < 0
        ? t('contacts.balancePayable', { amount: money.format(contact.balanceMinor) })
        : t('contacts.balanceSettled');

  return (
    <SwipeableRow
      isFirst={isFirst}
      isLast={isLast}
      onEdit={() => onEdit(contact)}
      onDelete={() => onDelete(contact)}
    >
      <Pressable
        onPress={() => onPress(contact)}
        onLongPress={() => onLongPress(contact)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={[
          contact.name,
          isPassive ? t('contacts.passiveTag') : null,
          subtitle,
          balanceLabel,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint={t('contacts.actions.hint')}
        accessibilityActions={[
          { name: 'edit', label: t('common.edit') },
          {
            name: 'toggleStatus',
            label: t(isPassive ? 'contacts.actions.activate' : 'contacts.actions.deactivate'),
          },
          { name: 'delete', label: t('common.delete') },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'edit') onEdit(contact);
          if (event.nativeEvent.actionName === 'toggleStatus') onToggleStatus(contact);
          if (event.nativeEvent.actionName === 'delete') onDelete(contact);
        }}
        className={cn(
          'min-h-16 flex-row items-center gap-3 bg-surface px-[14px] py-3 active:bg-surface-secondary',
          !isFirst && 'border-t border-separator',
        )}
      >
        <ContactAvatar name={contact.name} personType={contact.personType} isPassive={isPassive} />
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-x-2">
            <AppText
              weight="bold"
              numberOfLines={1}
              className={cn('shrink', isPassive && 'text-muted')}
            >
              {contact.name}
            </AppText>
            {isPassive ? (
              <Chip size="sm" variant="secondary" color="default">
                <Chip.Label maxFontSizeMultiplier={1.3}>{t('contacts.passiveTag')}</Chip.Label>
              </Chip>
            ) : null}
          </View>
          <AppText numberOfLines={1} className="text-[12px] leading-[17px] text-muted">
            {subtitle}
          </AppText>
        </View>
        <MoneyText minor={contact.balanceMinor} signed className="text-[15px]" />
      </Pressable>
    </SwipeableRow>
  );
});
