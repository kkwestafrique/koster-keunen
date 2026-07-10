import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ContractsList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');

  const columns = [
    { key: 'year', label: t('contracts.year') },
    { key: 'supplier_name', label: t('contracts.supplierName') },
    { key: 'country', label: t('contracts.country') },
    { key: 'type', label: t('contracts.type') },
    {
      key: 'standard',
      label: t('contracts.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    { key: 'signature_date', label: t('contracts.signatureDate') },
    { key: 'total_quantity_expected', label: t('contracts.totalQuantityExpected') },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('contracts.title')}</h1>
        <Button data-testid="create-contract-button" className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
          <Plus className="h-4 w-4 mr-1" /> {t('contracts.create')}
        </Button>
      </div>

      <FilterBar
        testId="contracts-table"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          {
            key: 'country',
            label: t('contracts.selectCountry'),
            value: country,
            onChange: setCountry,
            options: [],
          },
          {
            key: 'type',
            label: t('contracts.allContracts'),
            value: type,
            onChange: setType,
            options: [],
          },
        ]}
      />

      <DataTable
        testId="contracts-table"
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
