import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Shared list for Transactions > Received / Processing / Send.
// The live MIS uses the same table shape for all three, only the title and action differ.
export default function TransactionsList({ title, actionLabel, testId }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [txType, setTxType] = useState('');

  const columns = [
    { key: 'date', label: t('transactions.date') },
    { key: 'transaction_id', label: t('transactions.transactionId') },
    { key: 'actor_beekeeper', label: t('transactions.actorBeekeeper') },
    { key: 'product', label: t('transactions.product') },
    { key: 'quantity_delivered', label: t('transactions.quantityDelivered') },
    { key: 'total_amount', label: t('transactions.totalAmount') },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title}</h1>
        <Button data-testid={`${testId}-action-button`} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
          <Plus className="h-4 w-4 mr-1" /> {actionLabel}
        </Button>
      </div>

      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          { key: 'product', label: t('transactions.allProducts'), value: product, onChange: setProduct, options: [] },
          { key: 'type', label: t('transactions.allTransactions'), value: txType, onChange: setTxType, options: [] },
        ]}
      />

      <DataTable
        testId={testId}
        columns={columns}
        rows={[]}
        total={0}
        page={1}
        onPageChange={() => {}}
        loading={false}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
