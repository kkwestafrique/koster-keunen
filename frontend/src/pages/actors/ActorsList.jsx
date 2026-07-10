import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    { key: 'traceability_code', label: t('actorsList.traceabilityCode') },
    { key: 'contact_name', label: t('actorsList.actorName') },
    { key: 'actor_type', label: t('actorsList.actorType') },
    { key: 'country', label: t('actorsList.country') },
    { key: 'status', label: t('actorsList.status'), render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title || t('actorsList.title')}</h1>
        <Button
          data-testid="add-actor-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> {t('actorsList.addActor')}
        </Button>
      </div>

      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          {
            key: 'type',
            label: t('actorsList.allActorType'),
            value: actorType,
            onChange: (v) => { setActorType(v); setPage(1); },
            options: actorTypes.map((t2) => ({ value: t2.value, label: t2.label })),
          },
          {
            key: 'country',
            label: t('actorsList.allStatus'),
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
        emptyMessage={t('common.noRecordsFound')}
        onRowClick={(row) => navigate(`/actors/${row.id}`)}
      />

      <ActorFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
