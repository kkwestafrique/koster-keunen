import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import { useConnections, useApproveConnection, useDeleteConnection } from '@/hooks/useConnections';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import ConnectionFormDialog from '@/pages/connections/ConnectionFormDialog';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

const FILTER_DEFAULTS = { search: '', status: '', year: '', page: 1, pageSize: 5 };

export default function ConnectionsList() {
  const { t } = useTranslation();
  usePageTitle(t('connectionsList.title'));
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const { search, status, year, page, pageSize } = filters;
  const setPage = (v) => setFilters({ page: v });
  const setPageSize = (v) => setFilters({ pageSize: v, page: 1 });
  const setSearch = (v) => setFilters({ search: v, page: 1 });
  const setStatus = (v) => setFilters({ status: v, page: 1 });
  const setYear = (v) => setFilters({ year: v, page: 1 });
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useConnections({ page, pageSize, search, status, year });
  const { profile } = useAuth();
  const { canApprove, canDelete } = usePermissions();
  const { toast } = useToast();
  const approveConnection = useApproveConnection();
  const deleteConnection = useDeleteConnection();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleApprove = async (connectionId) => {
    try {
      await approveConnection.mutateAsync(connectionId);
      toast({ title: t('connectionsList.approved') });
    } catch (err) {
      toast({ title: t('connectionsList.approveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteConnection.mutateAsync(deleteTarget.id);
      toast({ title: t('connectionsList.deleteSuccess') });
    } catch (err) {
      toast({ title: t('connectionsList.deleteFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
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
      render: (row) => (row.is_supplier ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#5a6f9a]" />),
    },
    {
      key: 'is_buyer',
      label: t('connectionsList.buyer'),
      render: (row) => (row.is_buyer ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#5a6f9a]" />),
    },
    {
      key: 'approve_action',
      label: '',
      render: (row) =>
        row.status === 'Pending' && row.actor_to_id === profile?.current_actor_id && canApprove ? (
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
    ...(canDelete ? [{
      key: 'delete_action',
      label: '',
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`connection-delete-${row.id}`}
          className="text-[#ba550c] hover:text-[#ba550c] hover:bg-[#fdecea]"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    }] : []),
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
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onPageChange={setPage}
        loading={isLoading}
        isError={isError}
        onRetry={refetch}
      />

      <ConnectionFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="connection-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('connectionsList.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.status === 'Active'
                ? t('connectionsList.deleteConfirmDescriptionActive')
                : t('connectionsList.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="connection-delete-cancel">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="connection-delete-confirm-action"
              className="bg-[#ba550c] hover:bg-[#a34a0a]"
              onClick={handleDelete}
            >
              {t('connectionsList.deleteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
