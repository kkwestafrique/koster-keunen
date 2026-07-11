import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_OPTIONS = ['Cancelled', 'Inprogress', 'Completed', 'Failed'];
const STATUS_COLORS = {
  Completed: '#219653',
  Inprogress: '#79730a',
  Cancelled: '#7089b4',
  Failed: '#ba550c',
};

// Bulk uploads page, matching the live site: two tabs (Connections /
// Transactions) showing upload HISTORY only. There is deliberately no
// upload button here — file uploads happen inside the Multiple-transaction
// flows under Transactions > Received / Send.
function UploadStatus({ status }) {
  return (
    <span className="text-sm font-bold" style={{ color: STATUS_COLORS[status] || '#7089b4' }}>
      {status}
    </span>
  );
}

function UploadHistoryTable({ uploadType, showProgress, testId }) {
  const { t } = useTranslation();
  const { supplyChainId } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bulk_uploads', { uploadType, page, search, status, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('bulk_uploads')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('upload_type', uploadType)
        .order('created_at', { ascending: false });
      if (search) query = query.ilike('file_name', `%${search}%`);
      if (status) query = query.eq('status', status);
      const from = (page - 1) * 25;
      query = query.range(from, from + 24);
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
    { key: 'created_at', label: t('bulkUploads.uploadedOn'), render: (row) => row.created_at?.slice(0, 10) },
    ...(showProgress
      ? [{ key: 'progress', label: t('bulkUploads.progress'), render: (row) => (row.progress != null ? `${row.progress}%` : '—') }]
      : [
          { key: 'updated_beekeepers', label: t('bulkUploads.updatedBeekeepers') },
          { key: 'new_beekeepers', label: t('bulkUploads.newBeekeepers') },
        ]),
    { key: 'status', label: t('bulkUploads.status'), render: (row) => <UploadStatus status={row.status} /> },
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
        onPageChange={setPage}
        loading={isLoading}
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
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
          >
            {t('nav.connections')}
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            data-testid="bulk-tab-transactions"
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
          >
            {t('nav.transactions')}
          </TabsTrigger>
        </TabsList>

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
