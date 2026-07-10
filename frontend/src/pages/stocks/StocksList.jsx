import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// Shared list for Stocks > Raw material / Final product / Loss.
export default function StocksList({ title, actionLabel, testId }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [standard, setStandard] = useState('');
  const [village, setVillage] = useState('');

  const columns = [
    { key: 'stock_id', label: t('stocks.stockId') },
    { key: 'product', label: t('stocks.product') },
    { key: 'batch', label: t('stocks.batch') },
    {
      key: 'standard',
      label: t('stocks.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    { key: 'quantity_available', label: t('stocks.quantityAvailable') },
    {
      key: 'select',
      label: '',
      render: () => (
        <Button size="sm" variant="outline" className="border-[#0f48aa] text-[#0f48aa]">
          {t('stocks.select')}
        </Button>
      ),
    },
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
          { key: 'product', label: t('stocks.allProducts'), value: product, onChange: setProduct, options: [] },
          { key: 'standard', label: t('stocks.allStandards'), value: standard, onChange: setStandard, options: [] },
          { key: 'village', label: t('stocks.allVillages'), value: village, onChange: setVillage, options: [] },
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
