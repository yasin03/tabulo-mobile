import { router } from 'expo-router';
import { Landmark, Wallet } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { AccountWithBalance } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

/** Hesap bakiyeleri (7.2): yatay kaydırılan küçük kartlar. Dokununca o hesabın hareketleri açılır. */
export function AccountBalances({ accounts }: { accounts: readonly AccountWithBalance[] }) {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t('home.accounts')}
      className="-mx-5 grow-0"
      contentContainerClassName="gap-[10px] px-5"
    >
      {accounts.map((account) => {
        const Icon = account.type === 'bank' ? Landmark : Wallet;
        const balance =
          account.balanceMinor < 0
            ? money.formatSigned(account.balanceMinor)
            : money.format(account.balanceMinor);
        return (
          <Pressable
            key={account.id}
            accessibilityRole="button"
            accessibilityLabel={`${account.name}, ${balance}`}
            accessibilityHint={t('home.accountHint')}
            onPress={() =>
              router.push({ pathname: '/transactions', params: { accountId: account.id } })
            }
            className="min-h-[84px] min-w-[148px] max-w-[220px] gap-2 rounded-[18px] border border-border bg-surface p-[14px] active:bg-surface-secondary"
          >
            <Icon size={18} color={colors.primary} />
            <AppText numberOfLines={1} className="text-[13px] leading-[18px] text-muted">
              {account.name}
            </AppText>
            <AppText
              weight="extrabold"
              numberOfLines={1}
              adjustsFontSizeToFit
              className={cn(
                'text-[17px] leading-[22px]',
                account.balanceMinor < 0 && 'text-negative',
              )}
            >
              {balance}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
