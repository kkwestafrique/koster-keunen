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

// Shared list for Transactions > Received / Send — confirmed by the audit
// to genuinely share one 6-column shape (unlike Processing, which has its
// own distinct column set — see ProcessingTransactionsList.jsx). No
// Standard column/filter on either list per the audit; filters are
// Product and a "logged by" person filter instead.
export default function TransactionsList({ direction, title, actionLabel, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const NEW_ROUTES = {
    Received: '/transactions/received/new',
    Send: '/transactions/send/new',
  };
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [loggedBy, setLoggedBy] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const { data: products = [] } = useConstants('product_type');
  const { data: loggers = [] } = useTransactionLoggers();

  const { data, isLoading } = useTransactions({ direction, page, pageSize, search, product, loggedBy });

  const columns = [
    { key: 'transaction_date', label: t('transactions.date') },
    {
      key: 'transaction_code',
      label: t('transactions.transactionId'),
      // Human-readable code system is a later step — shows a placeholder
      // derived from the group id until then rather than nothing at all.
      render: (row) => row.transaction_code || String(row.transaction_group_id || '').slice(0, 8).toUpperCase(),
    },
    {
      key: 'actor_beekeeper',
      label: t('transactions.actorBeekeeper'),
      render: (row) => row.beekeepers?.full_name || row.actors?.contact_name || '—',
    },
    { key: 'product', label: t('transactions.product') },
    {
      key: 'quantity',
      label: t('transactions.quantityDelivered'),
      render: (row) => (row.total_quantity != null ? `${row.total_quantity} Kg` : '—'),
    },
    {
      key: 'total_amount',
      label: t('transactions.totalAmount'),
      render: (row) => (row.total_amount != null ? `${Number(row.total_amount).toLocaleString()} ${row.currency || ''}` : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title}</h1>
        <Button
          data-testid={`${testId}-action-button`}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          onClick={() => navigate(NEW_ROUTES[direction])}
        >
          <Plus className="h-4 w-4 mr-1" /> {actionLabel}
        </Button>
      </div>

      <FilterBar
        testId={testId}
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
        testId={testId}
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
        onRowClick={(row) => navigate(`/transactions/${direction.toLowerCase()}/${row.transaction_code}`)}
      />
    </AppLayout>
  );
}
