import { Eye, Pencil, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/ui/ActionSheet';
import type { TransactionListItem } from '@/db/repositories';

import { useTransactionActions } from './useTransactionActions';

type TransactionActionSheetProps = {
  transaction: TransactionListItem | null;
  onClose: () => void;
};

/** Hareket satırına uzun basınca açılan menü (8.3): kaydırma eylemlerinin aynısı + Aç. */
export function TransactionActionSheet({ transaction, onClose }: TransactionActionSheetProps) {
  const { t } = useTranslation();
  const actions = useTransactionActions();

  return (
    <ActionSheet
      isOpen={transaction !== null}
      onOpenChange={(open) => !open && onClose()}
      title={
        transaction
          ? transaction.description ||
            transaction.transactionTypeName ||
            t(`movementTypes.${transaction.movementType}`)
          : ''
      }
      items={
        transaction
          ? [
              {
                key: 'open',
                label: t('transactions.actions.open'),
                icon: Eye,
                onPress: () => actions.open(transaction),
              },
              {
                key: 'edit',
                label: t('common.edit'),
                icon: Pencil,
                onPress: () => actions.edit(transaction),
              },
              {
                key: 'delete',
                label: t('common.delete'),
                icon: Trash2,
                isDestructive: true,
                onPress: () => void actions.remove(transaction),
              },
            ]
          : []
      }
    />
  );
}
