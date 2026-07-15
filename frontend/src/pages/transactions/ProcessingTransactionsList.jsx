import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTransactions, useTransactionLoggers } from '@/hooks/useTransactions';
import { useConstants } from '@/hooks/useConstants';

// Processing has a genuinely different list shape than Send/Received per
// the audit (7 columns: Date, Transaction ID, Transaction type, Source
// product, Source quantity, Destination product, Destination quantity) —
// deliberately a separate component rather than forcing it into
// TransactionsList's shared shape, which was the bug this replaces.
export default function ProcessingTransactionsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [loggedBy, setLoggedBy] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const { data: products = [] } = useConstants('product_type');
  const { data: loggers = [] } = useTransactionLoggers();

  const { data, isLoading } = useTransactions({ direction: 'Processing', page, pageSize, search, product, loggedBy });

  const columns = [
    { key: 'transaction_date', label: t('transactions.date') },
    {
      key: 'transaction_code',
      label: t('transactions.transactionId'),
      render: (row) => row.transaction_code || String(row.transaction_group_id || '').slice(0, 8).toUpperCase(),
    },
    { key: 'transaction_type', label: t('processForm.transactionType') },
    { key: 'source_product', label: t('processForm.sourceProduct') },
    {
      key: 'source_quantity',
      label: t('processForm.sourceQuantity'),
      render: (row) => (row.source_quantity != null ? `${row.source_quantity} Kg` : '—'),
    },
    { key: 'product', label: t('processForm.destinationProduct') },
    {
      key: 'total_quantity',
      label: t('processForm.destinationQuantity'),
      render: (row) => (row.total_quantity != null ? `${row.total_quantity} Kg` : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('processForm.listTitle')}</h1>
        <Button
          data-testid="transactions-processing-table-action-button"
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          onClick={() => navigate('/transactions/processing/new')}
        >
          <Plus className="h-4 w-4 mr-1" /> {t('processForm.processStock')}
        </Button>
      </div>

      <FilterBar
        testId="transactions-processing-table"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          {
            key: 'product',
            label: t('transactions.allProducts'),
            value: product,
            onChange: (v) => { setProduct(v); setPage(1); },
            options: products.map((p) => ({ value: p.value, label: p.label })),
          },
          {
            key: 'loggedBy',
            label: t('transactions.allTransactions'),
            value: loggedBy,
            onChange: (v) => { setLoggedBy(v); setPage(1); },
            options: loggers,
          },
        ]}
      />

      <DataTable
        testId="transactions-processing-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
        onRowClick={(row) => navigate(`/transactions/processing/${row.transaction_code}`)}
      />
    </AppLayout>
  );
}
