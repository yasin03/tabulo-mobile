import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Button, SearchField } from 'heroui-native';
import {
  ArrowDownUp,
  Pencil,
  SearchX,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useCallback, useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ui/ActionSheet';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { contactsRepo } from '@/db';
import type { ContactListFilter, ContactSort, ContactWithBalance } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { ContactRow } from '@/features/contacts/ContactRow';
import { useContactActions, useContactLimit } from '@/features/contacts/useContactActions';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

const FILTERS = ['all', 'customer', 'supplier', 'debtors', 'creditors', 'passive'] as const;
type FilterKey = (typeof FILTERS)[number];

const FILTER_QUERY: Record<FilterKey, ContactListFilter> = {
  all: {},
  customer: { role: 'customer' },
  supplier: { role: 'supplier' },
  debtors: { balance: 'receivable' },
  creditors: { balance: 'payable' },
  passive: { status: 'passive' },
};

const SORTS: readonly ContactSort[] = ['name', 'balance', 'lastActivity'];

const countAll = () => contactsRepo.count();

export default function ContactsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const language = useLanguage();
  const actions = useContactActions();
  const ensureCanAdd = useContactLimit();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<ContactSort>('name');
  const [isSortOpen, setSortOpen] = useState(false);
  const [selected, setSelected] = useState<ContactWithBalance | null>(null);

  const query = useCallback(
    () =>
      contactsRepo.list({
        ...FILTER_QUERY[filter],
        search: deferredSearch,
        sort,
        locale: language === 'tr' ? 'tr' : 'en',
      }),
    [filter, deferredSearch, sort, language],
  );
  const { data: contacts = [], isLoading, isRefreshing, refresh } = useLiveQuery(query);
  const { data: total = 0 } = useLiveQuery(countAll);

  const addContact = useCallback(async () => {
    if (await ensureCanAdd()) router.push('/contact/new');
  }, [ensureCanAdd]);

  const openContact = actions.open;
  const openActions = useCallback((contact: ContactWithBalance) => {
    haptics.selection();
    setSelected(contact);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ContactWithBalance; index: number }) => (
      <ContactRow
        contact={item}
        isFirst={index === 0}
        isLast={index === contacts.length - 1}
        onPress={openContact}
        onLongPress={openActions}
        onEdit={actions.edit}
        onDelete={actions.remove}
        onToggleStatus={actions.toggleStatus}
      />
    ),
    [actions, contacts.length, openActions, openContact],
  );

  const hasNoContacts = !isLoading && total === 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top + 12 }}>
      <View className="gap-3 px-5 pb-3">
        <View className="min-h-11 flex-row items-center justify-between gap-3">
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className="flex-1 text-[26px] leading-[34px] tracking-[-0.5px]"
          >
            {t('tabs.contacts')}
          </AppText>
          {/* Boş durumda tek eylem butonu kartın içindedir (4.3). */}
          {hasNoContacts ? null : (
            <Button variant="primary" size="sm" className="min-h-11" onPress={addContact}>
              <UserPlus size={18} color={colors['accent-foreground']} strokeWidth={2.2} />
              <Button.Label>{t('contacts.add')}</Button.Label>
            </Button>
          )}
        </View>

        {hasNoContacts ? null : (
          <>
            <View className="flex-row items-center gap-2">
              <SearchField value={search} onChange={setSearch} className="flex-1">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    placeholder={t('contacts.searchPlaceholder')}
                    autoCorrect={false}
                    returnKeyType="search"
                    className="min-h-12"
                  />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('contacts.sort.title')}: ${t(`contacts.sort.${sort}`)}`}
                onPress={() => setSortOpen(true)}
                className="h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface active:opacity-70"
              >
                <ArrowDownUp size={20} color={colors.primary} />
              </Pressable>
            </View>

            <ChipGroup
              accessibilityLabel={t('contacts.filters.label')}
              options={FILTERS.map((key) => ({ value: key, label: t(`contacts.filters.${key}`) }))}
              isSelected={(key) => key === filter}
              onPress={setFilter}
            />
          </>
        )}
      </View>

      <FlashList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        // v2'de varsayılan açık: filtre/arama değişince eski kaydırma konumunu korumaya çalışıp
        // satırları aşağı kaydırıyor (ilk satır boş, sonuçlar aşağıda). Liste her seferinde baştan çizilmeli.
        maintainVisibleContentPosition={{ disabled: true }}
        extraData={contacts.length}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={isRefreshing}
        onRefresh={refresh}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
        ListEmptyComponent={
          isLoading ? null : (
            <View className="px-5">
              {hasNoContacts ? (
                <EmptyState
                  icon={Users}
                  title={t('contacts.empty.title')}
                  description={t('contacts.empty.description')}
                  action={
                    <Button variant="primary" className="mt-2 min-h-12" onPress={addContact}>
                      <UserPlus size={18} color={colors['accent-foreground']} strokeWidth={2.2} />
                      <Button.Label>{t('contacts.add')}</Button.Label>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title={t('contacts.noResults.title')}
                  description={t('contacts.noResults.description')}
                />
              )}
            </View>
          )
        }
      />

      <ActionSheet
        isOpen={isSortOpen}
        onOpenChange={setSortOpen}
        title={t('contacts.sort.title')}
        items={SORTS.map((key) => ({
          key,
          label: t(`contacts.sort.${key}`),
          isSelected: key === sort,
          onPress: () => setSort(key),
        }))}
      />

      <ActionSheet
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? ''}
        items={
          selected
            ? [
                {
                  key: 'edit',
                  label: t('common.edit'),
                  icon: Pencil,
                  onPress: () => actions.edit(selected),
                },
                {
                  key: 'status',
                  label: t(
                    selected.status === 'active'
                      ? 'contacts.actions.deactivate'
                      : 'contacts.actions.activate',
                  ),
                  icon: selected.status === 'active' ? UserMinus : UserCheck,
                  onPress: () => void actions.toggleStatus(selected),
                },
                {
                  key: 'delete',
                  label: t('common.delete'),
                  icon: Trash2,
                  isDestructive: true,
                  onPress: () => void actions.remove(selected),
                },
              ]
            : []
        }
      />
    </View>
  );
}
