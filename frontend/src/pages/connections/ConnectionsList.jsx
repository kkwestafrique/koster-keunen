import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Check, X } from 'lucide-react';
import { useConnections, useApproveConnection } from '@/hooks/useConnections';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ConnectionFormDialog from '@/pages/connections/ConnectionFormDialog';

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

export default function ConnectionsList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useConnections({ page, search, status, year });
  const { profile } = useAuth();
  const { toast } = useToast();
  const approveConnection = useApproveConnection();

  const handleApprove = async (connectionId) => {
    try {
      await approveConnection.mutateAsync(connectionId);
      toast({ title: t('connectionsList.approved') });
    } catch (err) {
      toast({ title: t('connectionsList.approveFailed'), description: err.message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'actor_from', label: t('connectionsList.actorFrom'), render: (row) => row.actor_from?.contact_name || '—' },
    { key: 'actor_to', label: t('connectionsList.actorTo'), render: (row) => row.actor_to?.contact_name || '—' },
    { key: 'connection_type', label: t('connectionsList.type') },
    { key: 'status', label: t('connectionsList.status'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'year', label: t('connectionsList.year') },
    {
      key: 'is_supplier',
      label: t('connectionsList.supplier'),
      render: (row) => (row.is_supplier ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#7089b4]" />),
    },
    {
      key: 'is_buyer',
      label: t('connectionsList.buyer'),
      render: (row) => (row.is_buyer ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#7089b4]" />),
    },
    {
      key: 'approve_action',
      label: '',
      render: (row) =>
        row.status === 'Pending' && row.actor_to_id === profile?.current_actor_id ? (
          <Button
            size="sm"
            data-testid={`connection-approve-${row.id}`}
            onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }}
            disabled={approveConnection.isPending}
            className="bg-[#219653] text-white hover:bg-[#1c7f47]"
          >
            {t('connectionsList.approve')}
          </Button>
        ) : null,
    },
  ];

  return (
    <AppLayout title={t('connectionsList.title')}>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-connection-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> {t('connectionsList.addConnection')}
        </Button>
      </div>

      <FilterBar
        testId="connections-filter-bar"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('connectionsList.searchPlaceholder')}
        filters={[
          {
            key: 'status',
            label: t('connectionsList.status'),
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [
              { value: 'Pending', label: t('connectionsList.pending') },
              { value: 'Active', label: t('common.active') },
              { value: 'Revoked', label: t('common.revoked') },
            ],
          },
          {
            key: 'year',
            label: t('connectionsList.year'),
            value: year,
            onChange: (v) => { setYear(v); setPage(1); },
            options: YEAR_OPTIONS,
          },
        ]}
      />

      <DataTable
        testId="connections-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        loading={isLoading}
      />

      <ConnectionFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
