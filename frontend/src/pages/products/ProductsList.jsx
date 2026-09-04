import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DataTable from '@/components/common/DataTable';
import { useConstants } from '@/hooks/useConstants';
import { usePageTitle } from '@/hooks/usePageTitle';

// Gap 4: products previously only existed as a fixed dropdown list buried
// inside forms (Contracts, Transactions, bulk upload templates) -- no
// page to just browse them.
//
// Reads from the constants table (category='product_type'), not the
// dedicated `products` table this page originally used. Found during a
// later review that `constants` was already the more deeply embedded
// system for products -- 4 real list pages (Transactions, Processing,
// Stocks, Loss) already read product options from it, versus this page
// being the only real user of the separate `products` table. Consolidated
// onto the system with more real, live usage rather than migrating four
// other pages to match this one.
export default function ProductsList() {
  const { t } = useTranslation();
  usePageTitle(t('productsList.title'));
  const { data: products = [], isLoading, isError, refetch } = useConstants('product_type');

  const columns = [
    { key: 'sort_order', label: '#', render: (row) => row.sort_order },
    { key: 'label', label: t('productsList.name'), sortable: true },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('productsList.title')}</h1>
      <p className="text-sm text-[#5a6f9a] mb-5">{t('productsList.description')}</p>

      <DataTable
        testId="products-list"
        columns={columns}
        rows={products}
        total={products.length}
        page={1}
        pageSize={products.length || 1}
        loading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </AppLayout>
  );
}
