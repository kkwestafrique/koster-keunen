import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { useContracts } from '@/hooks/useContracts';
import { useCountries } from '@/hooks/useReferenceData';
import { useActingActor } from '@/hooks/useActors';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import BulkImportContractsDialog from './BulkImportContractsDialog';
import { formatDate } from '@/lib/dateFormat';

// Matches the live site's "All contracts" filter exactly. Note there is no
// Standard filter on the live list page — Standard is still shown as a
// column, but Country and Contract type are the only two dropdown filters.
const CONTRACT_TYPE_OPTIONS = [
  { value: 'Send', label: 'Send' },
  { value: 'Received', label: 'Received' },
];

const money = (v) => (v != null ? Number(v).toLocaleString() : '—');

export default function ContractsList() {
  const { t } = useTranslation();
  usePageTitle(t('contractsList.title'));
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [contractType, setContractType] = useState('');
  const [page, setPage] = useState(1);
  // Gap 13: was 5 -- the same default the real platform's own audit
  // flagged as a real usability problem (398 beekeepers = 80 pages to
  // click through). 15 is still one of DataTable's offered options.
  const [pageSize, setPageSize] = useState(15);
  const { isReadOnly } = useActingActor();
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { data: countries = [] } = useCountries();

  const { data, isLoading } = useContracts({ page, pageSize, search, country, contractType });

  const columns = [
    { key: 'year', sortable: true, label: t('contracts.year') },
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
    { key: 'signature_date', label: t('contracts.signatureDate'), render: (row) => formatDate(row.signature_date) },
    {
      key: 'total_quantity_expected',
      label: t('contracts.totalQuantityExpected'),
      render: (row) => (row.total_quantity_expected != null ? `${row.total_quantity_expected} Kg` : '—'),
    },
    {
      key: 'percentage_yellow_wax',
      label: t('contracts.percentageYellowWax'),
      render: (row) => (row.percentage_yellow_wax != null ? `${row.percentage_yellow_wax} %` : '—'),
    },
    {
      key: 'yellow_wax_expected',
      label: t('contracts.yellowWaxExpected'),
      render: (row) => (row.yellow_wax_expected != null ? `${row.yellow_wax_expected} Kg` : '—'),
    },
    {
      key: 'brown_wax_expected',
      label: t('contracts.brownWaxExpected'),
      render: (row) => (row.brown_wax_expected != null ? `${row.brown_wax_expected} Kg` : '—'),
    },
    {
      key: 'yellow_wax_max_price',
      label: t('contracts.yellowWaxMaxPrice'),
      render: (row) => (row.yellow_wax_max_price != null ? `${money(row.yellow_wax_max_price)} ${row.currency || ''}` : '—'),
    },
    {
      key: 'brown_wax_max_price',
      label: t('contracts.brownWaxMaxPrice'),
      render: (row) => (row.brown_wax_max_price != null ? `${money(row.brown_wax_max_price)} ${row.currency || ''}` : '—'),
    },
    {
      key: 'total_contract_amount',
      label: t('contracts.totalAmount'),
      render: (row) => (row.total_contract_amount != null ? `${money(row.total_contract_amount)} ${row.currency || ''}` : '—'),
    },
    {
      key: 'advance_amount_paid',
      label: t('contracts.advanceAmountReceived'),
      render: (row) => (row.advance_amount_paid != null ? `${money(row.advance_amount_paid)} ${row.currency || ''}` : '—'),
    },
    {
      key: 'advance_percent',
      label: t('contracts.percentAdvance'),
      render: (row) => (row.advance_percent != null ? `${row.advance_percent} %` : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('contracts.title')}</h1>
        <div className="flex gap-2">
          <Button
            data-testid="contracts-bulk-import-button"
            variant="outline"
            className="border-[#0f48aa] text-[#0f48aa] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isReadOnly}
            title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined}
            onClick={() => setBulkImportOpen(true)}
          >
            <Upload className="h-4 w-4 mr-1" /> {t('contracts.bulkImport')}
          </Button>
          <Button
            data-testid="create-contract-button"
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isReadOnly}
            title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined}
            onClick={() => navigate('/contracts/new')}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('contracts.create')}
          </Button>
        </div>
      </div>

      <BulkImportContractsDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

      <FilterBar
        testId="contracts-table"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('contracts.searchPlaceholder')}
        filters={[
          {
            key: 'country',
            label: t('contracts.selectCountry'),
            value: country,
            onChange: (v) => { setCountry(v); setPage(1); },
            options: countries.map((c) => ({ value: c.name, label: c.name })),
            searchable: true,
          },
          {
            key: 'type',
            label: t('contracts.allContracts'),
            value: contractType,
            onChange: (v) => { setContractType(v); setPage(1); },
            options: CONTRACT_TYPE_OPTIONS,
          },
        ]}
      />

      <DataTable
        testId="contracts-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/contracts/${row.contract_code}`)}
        loading={isLoading}
        emptyMessage={t('common.noContractsFound')}
      />
    </AppLayout>
  );
}
