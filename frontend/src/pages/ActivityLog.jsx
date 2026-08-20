import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { useActivityLog } from '@/hooks/useActivityLog';
import { usePageTitle } from '@/hooks/usePageTitle';

const ENTITY_TYPES = ['Actor', 'Beekeeper', 'Contract', 'Stock', 'Transaction', 'Claim'];
const PAGE_SIZE = 15;

// Gap 8 (Medium, Phase 1): no dedicated audit-history screen existed --
// the who/when data was real but scattered across individual records.
// This shows the current state of every record across six entity types
// (who created it, who last touched it), most-recently-touched first.
//
// Deliberately NOT a full event-by-event log (what a field used to say
// before an edit) -- that's Gap 9, scoped separately as Admin-only future
// work. This page shows current state only, and is open to every role:
// the underlying activity_log view already inherits each table's own
// per-actor RLS scoping (verified directly -- a non-Admin session sees
// fewer rows than an Admin, matching what they can already see
// elsewhere in the app), so nobody sees anything here they couldn't
// already find by opening the record itself.
export default function ActivityLog() {
  const { t } = useTranslation();
  usePageTitle(t('activityLog.title'));
  const { data: rows = [], isLoading } = useActivityLog();

  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = rows;
    if (entityType) result = result.filter((r) => r.entity_type === entityType);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => (r.entity_label || '').toLowerCase().includes(q));
    }
    return result;
  }, [rows, entityType, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = [
    { key: 'entity_type', label: t('activityLog.type'), sortable: true },
    { key: 'entity_label', label: t('activityLog.record'), render: (row) => row.entity_label || '—', sortable: true },
    {
      key: 'created_by_name',
      label: t('activityLog.createdBy'),
      render: (row) => row.created_by_name || t('activityLog.unknown'),
    },
    {
      key: 'created_at',
      label: t('activityLog.createdAt'),
      render: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '—'),
      sortable: true,
    },
    {
      key: 'updated_by_name',
      label: t('activityLog.lastUpdatedBy'),
      render: (row) => row.updated_by_name || t('activityLog.unknown'),
    },
    {
      key: 'updated_at',
      label: t('activityLog.lastUpdatedAt'),
      render: (row) => (row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'),
      sortable: true,
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-1" data-testid="activity-log-title">{t('activityLog.title')}</h1>
      <p className="text-sm text-[#7089b4] mb-4">{t('activityLog.description')}</p>

      <FilterBar
        testId="activity-log"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('activityLog.searchPlaceholder')}
        filters={[
          {
            key: 'entityType',
            label: t('activityLog.allTypes'),
            value: entityType,
            onChange: (v) => { setEntityType(v); setPage(1); },
            options: ENTITY_TYPES.map((et) => ({ value: et, label: et })),
          },
        ]}
      />

      <DataTable
        testId="activity-log"
        columns={columns}
        rows={paged}
        total={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('activityLog.noRecords')}
      />
    </AppLayout>
  );
}
