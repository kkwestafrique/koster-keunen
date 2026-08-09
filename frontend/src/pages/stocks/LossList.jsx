import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { useLossRecords } from '@/hooks/useTransactions';
import { useConstants } from '@/hooks/useConstants';

// Real browsable Loss list, replacing the previous /stocks/loss page,
// which queried stocks where stock_type='Loss' — a data shape nothing in
// this app has ever actually populated. Loss is tracked as a number on
// Processing transactions (quantity_lost), computed and stored when the
// transaction is created; this just makes that number browsable.
export default function LossList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data: products = [] } = useConstants('product_type');
  const { data, isLoading } = useLossRecords({ page, pageSize, product, search });

  const columns = [
    { key: 'transaction_date', label: t('transactions.date') },
    { key: 'transaction_code', label: t('transactions.transactionId') },
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
    {
      key: 'quantity_lost',
      label: t('lossList.quantityLost'),
      render: (row) => <span className="text-[#ba550c] font-bold">{row.quantity_lost} Kg</span>,
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('lossList.title')}</h1>

      <FilterBar
        testId="loss-table"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('lossList.searchPlaceholder')}
        filters={[
          {
            key: 'product',
            label: t('transactions.allProducts'),
            value: product,
            onChange: (v) => { setProduct(v); setPage(1); },
            options: products.map((p) => ({ value: p.value, label: p.label })),
          },
        ]}
      />

      <DataTable
        testId="loss-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/transactions/processing/${row.transaction_code}`)}
        loading={isLoading}
        emptyMessage={t('lossList.noLossRecorded')}
      />
    </AppLayout>
  );
}
