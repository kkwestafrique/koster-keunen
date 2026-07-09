import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useActors } from '@/hooks/useActors';
import { useConstants } from '@/hooks/useConstants';
import ActorFormDialog from '@/pages/actors/ActorFormDialog';

// fixedStatus: 'Inactive' -> Potential actors, 'Active' -> Actual (confirmed) actors, null -> all
export default function ActorsList({ fixedStatus, title, testId }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actorType, setActorType] = useState('');
  const [country, setCountry] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const { data: actorTypes = [] } = useConstants('actor_type');
  const { data: countries = [] } = useConstants('country');

  const { data, isLoading } = useActors({
    page,
    search,
    actorType,
    country,
    status: fixedStatus || '',
  });

  const columns = [
    { key: 'traceability_code', label: 'Code' },
    { key: 'contact_name', label: 'Name' },
    { key: 'actor_type', label: 'Actor Type' },
    { key: 'country', label: 'Country' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'profile_completeness',
      label: 'Completeness',
      render: (row) => `${row.profile_completeness ?? 0}%`,
    },
  ];

  return (
    <AppLayout title={title}>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-actor-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Actor
        </Button>
      </div>

      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by code or name..."
        filters={[
          {
            key: 'type',
            label: 'Type',
            value: actorType,
            onChange: (v) => { setActorType(v); setPage(1); },
            options: actorTypes.map((t) => ({ value: t.value, label: t.label })),
          },
          {
            key: 'country',
            label: 'Country',
            value: country,
            onChange: (v) => { setCountry(v); setPage(1); },
            options: countries.map((c) => ({ value: c.value, label: c.label })),
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
        onRowClick={(row) => navigate(`/actors/${row.id}`)}
      />

      <ActorFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
