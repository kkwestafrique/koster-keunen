import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { formatDateTime } from '@/lib/dateFormat';

const STATUS_OPTIONS = ['Cancelled', 'Inprogress', 'Completed', 'Failed'];
const STATUS_COLORS = {
  Completed: '#219653',
  Inprogress: '#79730a',
  Cancelled: '#5a6f9a',
  Failed: '#ba550c',
};

// Bulk uploads page, matching the live site: two tabs (Connections /
// Transactions) showing upload HISTORY only. There is deliberately no
// upload button here — file uploads happen inside the Multiple-transaction
// flows under Transactions > Received / Send.
function UploadStatus({ status, errorDetail }) {
  return (
    <span
      className="text-sm font-bold"
      style={{ color: STATUS_COLORS[status] || '#5a6f9a' }}
      title={status === 'Failed' && errorDetail ? errorDetail : undefined}
      data-testid={status === 'Failed' && errorDetail ? 'upload-error-detail' : undefined}
    >
      {status}
      {status === 'Failed' && errorDetail && <span className="ml-1 text-xs font-normal underline decoration-dotted cursor-help">{'(?)'}</span>}
    </span>
  );
}

function UploadHistoryTable({ uploadType, showProgress, testId }) {
  const { t } = useTranslation();
  usePageTitle(t('bulkUploads.title'));
  const { supplyChainId } = useAuth();
  // Real gap found via the newest audit (M5), with a real, specific
  // wrinkle: this component renders twice on the same page (the
  // Connections and Transactions tabs both use it). Generic filter key
  // names in the URL would collide between the two -- switching tabs
  // would incorrectly inherit the other tab's leftover search/status/
  // page from the URL. Prefixed with the already-unique uploadType so
  // each tab's filters live under their own distinct URL params.
  const prefix = uploadType.toLowerCase();
  const FILTER_DEFAULTS = {
    [`${prefix}_page`]: 1,
    [`${prefix}_pageSize`]: 5,
    [`${prefix}_search`]: '',
    [`${prefix}_status`]: '',
  };
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const page = filters[`${prefix}_page`];
  const pageSize = filters[`${prefix}_pageSize`];
  const search = filters[`${prefix}_search`];
  const status = filters[`${prefix}_status`];
  const setPage = (v) => setFilters({ [`${prefix}_page`]: v });
  const setPageSize = (v) => setFilters({ [`${prefix}_pageSize`]: v, [`${prefix}_page`]: 1 });
  const setSearch = (v) => setFilters({ [`${prefix}_search`]: v, [`${prefix}_page`]: 1 });
  const setStatus = (v) => setFilters({ [`${prefix}_status`]: v, [`${prefix}_page`]: 1 });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bulk_uploads', { uploadType, page, pageSize, search, status, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('bulk_uploads')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('upload_type', uploadType)
        .order('created_at', { ascending: false });
      if (search) query = query.ilike('file_name', `%${search}%`);
      if (status) query = query.eq('status', status);
      // Same root cause as Stocks/Connections/Villages (BUG-02,
      // independent audit) -- not named in that report, but the
      // identical hardcoded-page-size pattern found here while fixing
      // the audited instances. Fixed for consistency.
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });

  const columns = [
    { key: 'id', label: t('bulkUploads.id'), render: (row) => String(row.id).slice(0, 8) },
    { key: 'file_name', label: t('bulkUploads.fileName') },
    { key: 'created_at', label: t('bulkUploads.uploadedOn'), render: (row) => formatDateTime(row.created_at) },
    ...(showProgress
      ? [{ key: 'progress', label: t('bulkUploads.progress'), render: (row) => (row.progress != null ? `${row.progress}%` : '—') }]
      : [
          { key: 'updated_beekeepers', label: t('bulkUploads.updatedBeekeepers') },
          { key: 'new_beekeepers', label: t('bulkUploads.newBeekeepers') },
        ]),
    { key: 'status', label: t('bulkUploads.status'), render: (row) => <UploadStatus status={row.status} errorDetail={row.error_detail} /> },
  ];

  return (
    <>
      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('bulkUploads.searchPlaceholder')}
        filters={[
          {
            key: 'status',
            label: t('bulkUploads.allStatus'),
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
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
        onPageChange={setPage}
        loading={isLoading}
        isError={isError}
        onRetry={refetch}
      />
    </>
  );
}

export default function BulkUploads() {
  const { t } = useTranslation();

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.bulkUploads')}</h1>

      <Tabs defaultValue="connections">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start mb-4">
          <TabsTrigger
            value="connections"
            data-testid="bulk-tab-connections"
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold"
          >
            {t('bulkUploads.beekeepersTab')}
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            data-testid="bulk-tab-transactions"
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold"
          >
            {t('nav.transactions')}
          </TabsTrigger>
        </TabsList>

        {/* Real gap found and fixed: this tab genuinely shows the
            history of beekeeper uploads, not connections at all --
            confirmed via bulk_uploads.upload_type, which only allows a
            fixed set of database values, and beekeeper uploads were
            mapped onto the existing 'Connections' value rather than
            given their own. Relabeled what's actually displayed
            (bulkUploads.beekeepersTab) without touching the underlying
            tab value or upload_type string below -- changing either of
            those would mean either a database migration across every
            existing historical row, or auditing every other place that
            filters by upload_type = 'Connections', for a fix that's
            purely about what a person sees, not what's stored. */}
        <TabsContent value="connections">
          <UploadHistoryTable uploadType="Connections" showProgress={false} testId="bulk-connections-table" />
        </TabsContent>
        <TabsContent value="transactions">
          <UploadHistoryTable uploadType="Transactions" showProgress testId="bulk-transactions-table" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
