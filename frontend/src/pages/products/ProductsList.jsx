import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DataTable from '@/components/common/DataTable';
import { useProducts } from '@/hooks/useReferenceData';
import { usePageTitle } from '@/hooks/usePageTitle';

// Gap 4: products previously only existed as a fixed dropdown list buried
// inside forms (Contracts, Transactions, bulk upload templates) -- no
// page to just browse them. Reads from the real products table (Gap 8's
// companion fix), not the old hardcoded constant.
export default function ProductsList() {
  const { t } = useTranslation();
  usePageTitle(t('productsList.title'));
  const { data: products = [], isLoading } = useProducts();

  const columns = [
    { key: 'display_order', label: '#', render: (row) => row.display_order },
    { key: 'name', label: t('productsList.name'), sortable: true },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('productsList.title')}</h1>
      <p className="text-sm text-[#7089b4] mb-5">{t('productsList.description')}</p>

      <DataTable
        testId="products-list"
        columns={columns}
        rows={products}
        total={products.length}
        page={1}
        pageSize={products.length || 1}
        loading={isLoading}
      />
    </AppLayout>
  );
}
