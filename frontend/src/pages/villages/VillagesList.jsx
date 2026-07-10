import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useVillages } from '@/hooks/useVillages';
import VillageFormDialog from '@/pages/villages/VillageFormDialog';

export default function VillagesList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useVillages({ page, search });

  const columns = [
    { key: 'name', label: t('villagesList.village') },
    { key: 'country', label: t('villagesList.country') },
    { key: 'state_region', label: t('villagesList.region') },
    { key: 'lga_municipality', label: t('villagesList.lga') },
    { key: 'beekeeper_count', label: t('villagesList.beekeepers') },
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
    </AppLayout>
  );
}
