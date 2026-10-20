import { Button } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { FormSection } from '@/components/ui/FormSection';
import { PickerField, type PickerOption } from '@/components/ui/PickerField';
import { MOVEMENT_TYPES } from '@/db/schema';
import { useColors } from '@/lib/theme';

import { EMPTY_FILTERS, PERIODS, type TransactionFilters } from './filters';
import type { TransactionFormData } from './useTransactionFormData';

type TransactionFilterSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  value: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
  data: TransactionFormData | undefined;
};

/** Pasif kayıtlar da filtrelenebilir (geçmiş hareketleri durur); etiketle ayrılır. */
function options(
  rows: readonly { id: string; name: string; status: string }[],
  passiveLabel: string,
): PickerOption[] {
  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    description: row.status === 'passive' ? passiveLabel : undefined,
  }));
}

/** Tüm hareketler filtreleri (7.8): dönem, hareket tipi, hesap, işlem türü, konu, cari. */
export function TransactionFilterSheet({
  isOpen,
  onClose,
  value,
  onApply,
  data,
}: TransactionFilterSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [draft, setDraft] = useState(value);

  // Uygulamadan kapatılırsa taslak atılır; bir sonraki açılış uygulanmış filtrelerle başlar.
  const close = () => {
    setDraft(value);
    onClose();
  };

  const set = <K extends keyof TransactionFilters>(key: K, next: TransactionFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: next }));

  const passive = t('contacts.passiveTag');
  const accountOptions = useMemo(() => options(data?.accounts ?? [], passive), [data, passive]);
  const contactOptions = useMemo(() => options(data?.contacts ?? [], passive), [data, passive]);
  const subjectOptions = useMemo(() => options(data?.subjects ?? [], passive), [data, passive]);
  const typeOptions = useMemo<PickerOption[]>(
    () =>
      (data?.transactionTypes ?? []).map((type) => ({
        value: type.id,
        label: type.name,
        description: [
          t(
            type.direction === 'income'
              ? 'transactionFilters.income'
              : 'transactionFilters.expense',
          ),
          type.status === 'passive' ? passive : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [data, passive, t],
  );

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={close}
    >
      <SafeAreaProvider>
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
          <View className="flex-row items-center gap-2 px-5 pb-2 pt-3">
            <AppText weight="extrabold" accessibilityRole="header" className="flex-1 text-[18px]">
              {t('transactionFilters.title')}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft(EMPTY_FILTERS)}
              className="min-h-11 justify-center px-2 active:opacity-70"
            >
              <AppText weight="bold" className="text-primary">
                {t('transactionFilters.reset')}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={close}
              className="h-11 w-11 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70"
            >
              <X size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-4 px-5 pb-6">
            <FormSection title={t('transactionFilters.period')}>
              <ChipGroup
                layout="wrap"
                accessibilityLabel={t('transactionFilters.period')}
                options={PERIODS.map((key) => ({
                  value: key,
                  label: t(`transactionFilters.periods.${key}`),
                }))}
                isSelected={(key) => key === draft.period}
                onPress={(key) => set('period', key)}
              />
              {draft.period === 'custom' ? (
                <View className="gap-3">
                  <DateField
                    label={t('transactionFilters.from')}
                    placeholder={t('transactionFilters.noLimit')}
                    isClearable
                    value={draft.from}
                    onChange={(next) => set('from', next)}
                  />
                  <DateField
                    label={t('transactionFilters.to')}
                    placeholder={t('transactionFilters.noLimit')}
                    isClearable
                    value={draft.to}
                    minimumDate={draft.from || undefined}
                    onChange={(next) => set('to', next)}
                  />
                </View>
              ) : null}
            </FormSection>

            <FormSection title={t('transactionForm.movementType')}>
              <ChipGroup
                layout="wrap"
                multiple
                accessibilityLabel={t('transactionForm.movementType')}
                options={MOVEMENT_TYPES.map((type) => ({
                  value: type,
                  label: t(`movementTypes.${type}`),
                }))}
                isSelected={(type) => draft.movementTypes.includes(type)}
                onPress={(type) =>
                  set(
                    'movementTypes',
                    draft.movementTypes.includes(type)
                      ? draft.movementTypes.filter((x) => x !== type)
                      : [...draft.movementTypes, type],
                  )
                }
              />
            </FormSection>

            <FormSection title={t('transactionFilters.records')}>
              <PickerField
                label={t('transactionForm.contact')}
                placeholder={t('transactionFilters.any')}
                value={draft.contactId}
                options={contactOptions}
                onChange={(next) => set('contactId', next)}
              />
              <PickerField
                label={t('transactionForm.account')}
                placeholder={t('transactionFilters.any')}
                value={draft.accountId}
                options={accountOptions}
                onChange={(next) => set('accountId', next)}
              />
              <PickerField
                label={t('transactionDetail.type')}
                placeholder={t('transactionFilters.any')}
                value={draft.transactionTypeId}
                options={typeOptions}
                onChange={(next) => set('transactionTypeId', next)}
              />
              <PickerField
                label={t('transactionForm.subject')}
                placeholder={t('transactionFilters.any')}
                value={draft.subjectId}
                options={subjectOptions}
                onChange={(next) => set('subjectId', next)}
              />
            </FormSection>
          </ScrollView>

          <View className="border-t border-border px-5 pt-3">
            <Button variant="primary" size="lg" className="h-[52px]" onPress={apply}>
              <Button.Label className="text-[16px]">{t('transactionFilters.apply')}</Button.Label>
            </Button>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
