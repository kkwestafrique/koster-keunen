import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { useConstants } from '@/hooks/useConstants';
import { useNavigate } from 'react-router-dom';

export default function ContractsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [contractType, setContractType] = useState('');
  const [standard, setStandard] = useState('');
  const [page, setPage] = useState(1);

  const { data: countries = [] } = useConstants('country');
  const { data: standards = [] } = useConstants('standard');

  const { data, isLoading } = useContracts({ page, search, country, contractType, standard });

  const columns = [
    { key: 'year', label: t('contracts.year') },
    {
      key: 'supplier_name',
      label: t('contracts.supplierName'),
      render: (row) => row.actors?.contact_name || row.actors?.traceability_code || '—',
    },
    { key: 'country', label: t('contracts.country') },
    { key: 'contract_type', label: t('contracts.type') },
    {
      key: 'standard',
      label: t('contracts.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    { key: 'signature_date', label: t('contracts.signatureDate') },
    {
      key: 'expected_quantity',
      label: t('contracts.totalQuantityExpected'),
      render: (row) => (row.total_quantity_expected != null ? `${row.total_quantity_expected} Kg` : '—'),
    },
    {
      key: 'total_amount',
      label: t('contracts.totalAmount') || 'Total amount',
      render: (row) => (row.total_contract_amount != null ? Number(row.total_contract_amount).toLocaleString() : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('contracts.title')}</h1>
        <Button
          data-testid="create-contract-button"
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          onClick={() => navigate('/contracts/new')}
        >
          <Plus className="h-4 w-4 mr-1" /> {t('contracts.create')}
        </Button>
      </div>

      <FilterBar
        testId="contracts-table"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          {
            key: 'country',
            label: t('contracts.selectCountry'),
            value: country,
            onChange: (v) => { setCountry(v); setPage(1); },
            options: countries.map((c) => ({ value: c.value, label: c.label })),
          },
          {
            key: 'type',
            label: t('contracts.allContracts'),
            value: contractType,
            onChange: (v) => { setContractType(v); setPage(1); },
            options: [
              { value: 'Send', label: 'Send' },
              { value: 'Receive', label: 'Receive' },
            ],
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
        testId="contracts-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/contracts/${row.contract_group_id}`)}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
