import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native';
import {
  Ellipsis,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  SearchX,
  Trash2,
  UserCheck,
  UserMinus,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddMovementSheet, CONTACT_MOVEMENT_TYPES } from '@/components/navigation/AddMovementSheet';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { groupByMonth } from '@/core/grouping';
import { balanceState, nearestDue, type MovementType } from '@/core/ledger';
import { formatPhone } from '@/core/validation';
import { contactsRepo, remindersRepo, transactionsRepo } from '@/db';
import type { ContactRole, TransactionListItem } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { ContactAvatar } from '@/features/contacts/ContactAvatar';
import { ContactBalanceCard } from '@/features/contacts/ContactBalanceCard';
import { useContactActions } from '@/features/contacts/useContactActions';
import { WhatsAppDialog } from '@/features/contacts/WhatsAppDialog';
import { ReminderRow } from '@/features/reminders/ReminderRow';
import { useReminderActions } from '@/features/reminders/useReminderActions';
import { MonthHeader } from '@/features/transactions/MonthHeader';
import { TransactionActionSheet } from '@/features/transactions/TransactionActionSheet';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { useTransactionActions } from '@/features/transactions/useTransactionActions';
import { useBusinessProfile, useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { usePremiumGate } from '@/lib/premium';
import { useColors } from '@/lib/theme';
import { useToday } from '@/lib/useToday';

type FilterKey = 'all' | 'sales' | 'purchases' | 'collections' | 'payments';

const FILTER_TYPES: Record<Exclude<FilterKey, 'all'>, MovementType> = {
  sales: 'credit_sale',
  purchases: 'credit_purchase',
  collections: 'collection',
  payments: 'payment',
};

/** Filtreler cari tipine göre (kullanıcı kararı): tedarikçide Satışlar yerine Alışlar, "İkisi"nde ikisi de. */
const FILTERS_BY_ROLE: Record<ContactRole, readonly FilterKey[]> = {
  customer: ['all', 'sales', 'collections', 'payments'],
  supplier: ['all', 'purchases', 'collections', 'payments'],
  both: ['all', 'sales', 'purchases', 'collections', 'payments'],
};

const BOTTOM_BAR_HEIGHT = 78;

/** Cari detay (7.4, client-detail.html). */
export default function ContactDetailScreen() {
  const { t } = useTranslation();
  const requirePremium = usePremiumGate();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const { phoneCountry } = money;
  const dates = useDates();
  const today = useToday();
  const business = useBusinessProfile();
  const contactActions = useContactActions();
  const transactionActions = useTransactionActions();
  const reminderActions = useReminderActions();

  const query = useCallback(async () => {
    const [contact, balanceMinor, transactions, reminders] = await Promise.all([
      contactsRepo.getById(id),
      contactsRepo.balance(id),
      transactionsRepo.listForContact(id),
      remindersRepo.listPending({ contactId: id }),
    ]);
    return { contact, balanceMinor, transactions, reminders };
  }, [id]);
  const { data, error, isLoading, isRefreshing, refresh } = useLiveQuery(query);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);
  const [isWhatsAppOpen, setWhatsAppOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionListItem | null>(null);

  const contact = data?.contact;
  const filters = FILTERS_BY_ROLE[contact?.role ?? 'customer'];
  const activeFilter = filters.includes(filter) ? filter : 'all';

  const items = useMemo(() => {
    const all = data?.transactions ?? [];
    const visible =
      activeFilter === 'all'
        ? all
        : all.filter((tx) => tx.movementType === FILTER_TYPES[activeFilter]);
    return groupByMonth(visible);
  }, [data?.transactions, activeFilter]);

  // Liste en yeniden eskiye gelir; FIFO için kronolojik sıra gerekir.
  const due = useMemo(() => (data ? nearestDue([...data.transactions].reverse()) : null), [data]);

  const openActions = useCallback((tx: TransactionListItem) => {
    haptics.selection();
    setSelected(tx);
  }, []);

  const addTransaction = () => {
    if (contact?.status === 'passive') {
      haptics.warning();
      Alert.alert(t('contactDetail.passiveTitle'), t('contactDetail.passiveMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('contacts.actions.activate'),
          onPress: () => void contactActions.toggleStatus(contact),
        },
      ]);
      return;
    }
    setAddOpen(true);
  };

  const title = t('contactDetail.title');

  if (!contact) {
    return (
      <View className="flex-1 bg-background px-5 pt-4">
        <Stack.Screen options={{ title }} />
        {error && !isLoading ? (
          <EmptyState icon={SearchX} title={t('errors.domain.notFound')} />
        ) : null}
      </View>
    );
  }

  const location = [contact.district, contact.city].filter(Boolean).join(', ');
  const subtitle = [
    t(`contactRoles.${contact.role}`),
    t(`personTypes.${contact.personType}`),
    contact.status === 'passive' ? t('contacts.passiveTag') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const hasTransactions = (data?.transactions.length ?? 0) > 0;
  const reminders = data?.reminders ?? [];

  /** Varsayılan WhatsApp mesajı (6.7): bakiye durumuna göre; işletme adı varsa imza. */
  const balanceMinor = data?.balanceMinor ?? 0;
  const whatsappMessage = [
    t(`contactDetail.whatsappMessage.${balanceState(balanceMinor)}`, {
      name: contact.name,
      date: dates.format(today, 'full'),
      amount: money.format(Math.abs(balanceMinor)),
    }),
    business.name ? t('contactDetail.whatsappSignature', { business: business.name }) : null,
  ]
    .filter(Boolean)
    .join(' ');

  const remind = () =>
    router.push({ pathname: '/reminders/new', params: { contactId: contact.id } });

  const header = (
    <View className="gap-4 px-5 pb-2 pt-2">
      <View className="flex-row items-center gap-[14px]">
        <ContactAvatar
          name={contact.name}
          personType={contact.personType}
          size="lg"
          solid
          isPassive={contact.status === 'passive'}
        />
        <View className="flex-1 gap-[3px]">
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className="text-[20px] leading-[26px]"
          >
            {contact.name}
          </AppText>
          <AppText className="text-[13px] leading-[18px] text-muted">{subtitle}</AppText>
          {location ? (
            <AppText className="text-[13px] leading-[18px] text-muted">{location}</AppText>
          ) : null}
        </View>
      </View>

      {contact.phone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('contactDetail.call', {
            phone: formatPhone(contact.phone, phoneCountry),
          })}
          onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
          className="min-h-11 flex-row items-center gap-2 self-start rounded-full border border-border bg-surface px-4 active:opacity-70"
        >
          <Phone size={16} color={colors.primary} />
          <AppText weight="semibold" className="text-primary">
            {formatPhone(contact.phone, phoneCountry)}
          </AppText>
        </Pressable>
      ) : null}

      <ContactBalanceCard
        balanceMinor={data?.balanceMinor ?? 0}
        due={due}
        hasPhone={!!contact.phone}
        onSendStatement={() => {
          if (requirePremium('whatsappStatement')) {
            router.push({ pathname: '/export/statement', params: { contactId: contact.id } });
          }
        }}
        onRemind={remind}
        onWhatsApp={() => setWhatsAppOpen(true)}
      />

      {reminders.length > 0 ? (
        <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
          {reminders.map((reminder, index) => (
            <ReminderRow
              key={reminder.id}
              item={reminder}
              today={today}
              isFirst={index === 0}
              showContact={false}
              onComplete={(r) => void reminderActions.complete(r)}
              menuItems={[
                {
                  key: 'edit',
                  label: t('common.edit'),
                  onPress: () => reminderActions.edit(reminder),
                },
                {
                  key: 'delete',
                  label: t('common.delete'),
                  onPress: () => void reminderActions.remove(reminder),
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {hasTransactions ? (
        <ChipGroup
          accessibilityLabel={t('contacts.filters.label')}
          options={filters.map((key) => ({ value: key, label: t(`contactDetail.filters.${key}`) }))}
          isSelected={(key) => key === activeFilter}
          onPress={setFilter}
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('contactDetail.moreActions')}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Ellipsis size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <FlashList
        data={items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        ListHeaderComponent={header}
        maintainVisibleContentPosition={{ disabled: true }}
        refreshing={isRefreshing}
        onRefresh={refresh}
        contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom + 16 }}
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <MonthHeader month={item.month} />
          ) : (
            <TransactionRow
              item={item.item}
              variant="contact"
              isFirst={item.isFirst}
              isLast={item.isLast}
              onPress={transactionActions.open}
              onLongPress={openActions}
              onEdit={transactionActions.edit}
              onDelete={(tx) => void transactionActions.remove(tx)}
            />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton className="mx-5 mt-2" rows={4} avatar={false} />
          ) : (
            <View className="px-5 pt-2">
              <EmptyState
                icon={ReceiptText}
                title={t(
                  hasTransactions ? 'contactDetail.emptyFiltered' : 'contactDetail.empty.title',
                )}
                description={hasTransactions ? undefined : t('contactDetail.empty.description')}
              />
            </View>
          )
        }
      />

      <View
        className="absolute inset-x-0 bottom-0 border-t border-border bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button variant="primary" size="lg" className="h-[54px]" onPress={addTransaction}>
          <Plus size={22} color={colors['accent-foreground']} strokeWidth={2.6} />
          <Button.Label className="font-extrabold text-[16px]">{t('tabs.add')}</Button.Label>
        </Button>
      </View>

      <AddMovementSheet
        isOpen={isAddOpen}
        onOpenChange={setAddOpen}
        types={CONTACT_MOVEMENT_TYPES}
        onSelect={(type) => {
          setAddOpen(false);
          router.push({ pathname: '/transaction/new', params: { type, contactId: contact.id } });
        }}
      />

      <ActionSheet
        isOpen={isMenuOpen}
        onOpenChange={setMenuOpen}
        title={contact.name}
        items={[
          {
            key: 'edit',
            label: t('common.edit'),
            icon: Pencil,
            onPress: () => contactActions.edit(contact),
          },
          {
            key: 'status',
            label: t(
              contact.status === 'active'
                ? 'contacts.actions.deactivate'
                : 'contacts.actions.activate',
            ),
            icon: contact.status === 'active' ? UserMinus : UserCheck,
            onPress: () => void contactActions.toggleStatus(contact),
          },
          {
            key: 'delete',
            label: t('common.delete'),
            icon: Trash2,
            isDestructive: true,
            onPress: () =>
              void contactActions.remove(contact).then((deleted) => deleted && router.back()),
          },
        ]}
      />

      <TransactionActionSheet transaction={selected} onClose={() => setSelected(null)} />

      {contact.phone ? (
        <WhatsAppDialog
          isOpen={isWhatsAppOpen}
          phone={contact.phone}
          initialMessage={whatsappMessage}
          onClose={() => setWhatsAppOpen(false)}
        />
      ) : null}
    </View>
  );
}
