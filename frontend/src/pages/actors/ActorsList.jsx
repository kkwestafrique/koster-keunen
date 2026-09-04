import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useActors, useActingActor } from '@/hooks/useActors';
import { useAuth } from '@/contexts/AuthContext';
import ActorFormDialog from '@/pages/actors/ActorFormDialog';
import { ACTOR_TYPES } from '@/data/regions';
import { useActorTypes } from '@/hooks/useActorTypes';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePageTitle } from '@/hooks/usePageTitle';

// Matches the live site's Actor Type filter exactly — 'Buyer' is a valid
// actor_type value elsewhere in the app but is not offered here or in the
// Add Actor radios, same audited discrepancy noted in ActorFormDialog.
// Reuses the same ACTOR_TYPES constant as ActorFormDialog's radios so the
// two can never silently drift apart.
const ACTOR_TYPE_FILTER_OPTIONS = ACTOR_TYPES;

// Gap 13: pageSize default was 5 -- the same default the real platform's
// own audit flagged as a real usability problem (398 beekeepers = 80
// pages to click through). 15 is still one of DataTable's offered
// options.
const FILTER_DEFAULTS = { search: '', actorType: '', status: '', page: 1, pageSize: 15 };

export default function ActorsList({ title, testId }) {
  const { t } = useTranslation();
  usePageTitle(title || t('actorsList.title'));
  const { profile } = useAuth();
  const { data: actorTypeOptions = ACTOR_TYPE_FILTER_OPTIONS } = useActorTypes();
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const { search, actorType, status, page, pageSize } = filters;
  const setPage = (v) => setFilters({ page: v });
  const setPageSize = (v) => setFilters({ pageSize: v, page: 1 });
  const setSearch = (v) => setFilters({ search: v, page: 1 });
  const setActorType = (v) => setFilters({ actorType: v, page: 1 });
  const setStatus = (v) => setFilters({ status: v, page: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();
  const { isReadOnly } = useActingActor();

  // No toggle, for any role. Every actor list is unconditionally scoped
  // to real, active connections with your current actor, excluding
  // yourself. There is no control, no checkbox, no way to opt into seeing
  // the full company directory from this page, for anyone -- that need is
  // served separately by useActorDirectory() inside Add Connection, the
  // Contract wizard's supplier picker, and Send's destination picker,
  // where browsing everyone is a genuine, distinct, deliberate need.
  const connectedOnly = true;

  const { data, isLoading } = useActors({
    page,
    pageSize,
    search,
    actorType,
    status,
    connectedOnly,
    currentActorId: profile?.current_actor_id,
  });

  const columns = [
    { key: 'traceability_code', sortable: true, label: t('actorsList.traceabilityCode') },
    { key: 'contact_name', sortable: true, label: t('actorsList.actorName') },
    { key: 'actor_type', label: t('actorsList.actorType') },
    { key: 'country', label: t('actorsList.country') },
    {
      key: 'status',
      // Real gap found live: this column showed a status with zero
      // explanation of what it means. Turned out to be worth being
      // honest about, not just adding a plausible-sounding tooltip --
      // checked the actual code and confirmed Active and Inactive have
      // NO functional difference anywhere in the app today. Only
      // Disabled actually restricts anything (locks the actor into
      // read-only mode). The tooltip says exactly that, not more.
      label: <span title={t('actorsList.statusTooltip')}>{t('actorsList.status')}</span>,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title || t('actorsList.title')}</h1>
        <Button
          data-testid="add-actor-button"
          onClick={() => setFormOpen(true)}
          disabled={isReadOnly}
          title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] disabled:opacity-50 disabled:cursor-not-allowed"
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
            options: actorTypeOptions.map((v) => ({ value: v, label: v })),
          },
          {
            key: 'status',
            label: t('actorsList.allStatus'),
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [
              { value: 'Active', label: t('common.active') },
              { value: 'Inactive', label: t('common.inactive') },
              { value: 'Disabled', label: t('common.disabled') },
            ],
          },
        ]}
      />

      <DataTable
        testId={testId}
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        showFirstLast={false}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
        onRowClick={(row) => navigate(`/actors/${row.id}`)}
      />

      <ActorFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
