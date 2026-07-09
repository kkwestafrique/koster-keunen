import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useAllVillagesLite } from '@/hooks/useVillages';
import { useConstants } from '@/hooks/useConstants';
import BeekeeperFormDialog from '@/pages/beekeepers/BeekeeperFormDialog';

// fixedStatus: 'Potential' | 'Actual' | null (full list)
export default function BeekeepersList({ fixedStatus, title, testId }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [villageId, setVillageId] = useState('');
  const [standard, setStandard] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const { data: villages = [] } = useAllVillagesLite();
  const { data: standards = [] } = useConstants('standard');

  const { data, isLoading } = useBeekeepers({
    page,
    search,
    gender,
    villageId,
    status: fixedStatus || '',
  });

  const columns = [
    { key: 'traceability_code', label: 'Code' },
    { key: 'full_name', label: 'Full Name' },
    { key: 'gender', label: 'Gender' },
    { key: 'village', label: 'Village', render: (row) => row.villages?.name || '—' },
    { key: 'actor', label: 'Organisation', render: (row) => row.actors?.contact_name || '—' },
    { key: 'total_hives', label: 'Total Hives' },
    { key: 'active_years', label: 'Active Years' },
  ];

  return (
    <AppLayout title={title}>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-beekeeper-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Beekeeper
        </Button>
      </div>

      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by code or name..."
        filters={[
          {
            key: 'gender',
            label: 'Gender',
            value: gender,
            onChange: (v) => { setGender(v); setPage(1); },
            options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }],
          },
          {
            key: 'village',
            label: 'Village',
            value: villageId,
            onChange: (v) => { setVillageId(v); setPage(1); },
            options: villages.map((v) => ({ value: v.id, label: v.name })),
          },
          {
            key: 'standard',
            label: 'Standard',
            value: standard,
            onChange: (v) => setStandard(v),
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
        onRowClick={(row) => navigate(`/beekeepers/${row.id}`)}
      />

      <BeekeeperFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
