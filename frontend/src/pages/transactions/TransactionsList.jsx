import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';
import { useConstants } from '@/hooks/useConstants';

// Shared list for Transactions > Received / Processing / Send.
// The live MIS uses the same table shape for all three, only the title, action and direction filter differ.
export default function TransactionsList({ direction, title, actionLabel, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const NEW_ROUTES = {
    Received: '/transactions/received/new',
    Processing: '/transactions/processing/new',
    Send: '/transactions/send/new',
  };
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [standard, setStandard] = useState('');
  const [page, setPage] = useState(1);

  const { data: products = [] } = useConstants('product_type');
  const { data: standards = [] } = useConstants('standard');

  const { data, isLoading } = useTransactions({ direction, page, search, product, standard });

  const columns = [
    { key: 'transaction_date', label: t('transactions.date') },
    {
      key: 'actor_beekeeper',
      label: t('transactions.actorBeekeeper'),
      render: (row) => row.beekeepers?.full_name || row.actors?.contact_name || '—',
    },
    { key: 'product', label: t('transactions.product') },
    {
      key: 'standard',
      label: t('contracts.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    {
      key: 'quantity',
      label: t('transactions.quantityDelivered'),
      render: (row) => (row.quantity != null ? `${row.quantity} ${row.unit || ''}` : '—'),
    },
    {
      key: 'total_amount',
      label: t('transactions.totalAmount'),
      render: (row) => (row.total_amount != null ? row.total_amount.toLocaleString() : '—'),
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
            key: 'standard',
            label: t('contracts.standard'),
            value: standard,
            onChange: (v) => { setStandard(v); setPage(1); },
            options: standards.map((s) => ({ value: s.value, label: s.label })),
          },
        ]}
      />

      <DataTable
        testId={testId}
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
