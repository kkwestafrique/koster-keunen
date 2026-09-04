import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useVillages, useDeleteVillage } from '@/hooks/useVillages';
import VillageFormDialog from '@/pages/villages/VillageFormDialog';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
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

const FILTER_DEFAULTS = { search: '', page: 1 };

export default function VillagesList() {
  const { t } = useTranslation();
  usePageTitle(t('villagesList.title'));
  const [filters, setFilters] = useUrlFilters(FILTER_DEFAULTS);
  const { search, page } = filters;
  const setPage = (v) => setFilters({ page: v });
  const setSearch = (v) => setFilters({ search: v, page: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { canDelete } = usePermissions();
  const { toast } = useToast();
  const deleteVillage = useDeleteVillage();

  const { data, isLoading } = useVillages({ page, search });

  const handleDelete = async () => {
    try {
      await deleteVillage.mutateAsync(deleteTarget.id);
      toast({ title: t('villagesList.deleteSuccess') });
    } catch (err) {
      // Real, deliberate design: the database's own foreign key
      // constraints (beekeepers/connections/stocks referencing this
      // village, all NO ACTION) are the actual safety net here, not
      // anything built client-side. A village still genuinely in use
      // is rejected with a real constraint error, surfaced through the
      // same friendly-error translation already used everywhere else
      // in the app rather than a raw Postgres message.
      toast({ title: t('villagesList.deleteFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      key: 'name',
      label: t('villagesList.village'),
      render: (row) => <span className="block max-w-[200px] truncate" title={row.name}>{row.name}</span>,
    },
    { key: 'country', label: t('villagesList.country') },
    { key: 'state_region', label: t('villagesList.region') },
    { key: 'lga_municipality', label: t('villagesList.lga') },
    { key: 'beekeeper_count', label: t('villagesList.beekeepers') },
    ...(canDelete ? [{
      key: 'actions',
      label: '',
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`village-delete-${row.id}`}
          className="text-[#ba550c] hover:text-[#ba550c] hover:bg-[#fdecea]"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    }] : []),
  ];

  return (
    <AppLayout title={t('villagesList.title')}>
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-village-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> {t('villagesList.addVillage')}
        </Button>
      </div>

      <FilterBar
        testId="villages-filter-bar"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('villagesList.searchPlaceholder')}
        filters={[]}
      />

      <DataTable
        testId="villages-table"
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        loading={isLoading}
      />

      <VillageFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="village-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('villagesList.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('villagesList.deleteConfirmDescription', { name: deleteTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="village-delete-cancel">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="village-delete-confirm-action"
              className="bg-[#ba550c] hover:bg-[#a34a0a]"
              onClick={handleDelete}
            >
              {t('villagesList.deleteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
