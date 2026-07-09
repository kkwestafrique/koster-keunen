import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useVillages } from '@/hooks/useVillages';
import VillageFormDialog from '@/pages/villages/VillageFormDialog';

export default function VillagesList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useVillages({ page, search });

  const columns = [
    { key: 'name', label: 'Village' },
    { key: 'country', label: 'Country' },
    { key: 'state_region', label: 'Region' },
    { key: 'lga_municipality', label: 'LGA' },
    { key: 'beekeeper_count', label: 'Beekeepers' },
  ];

  return (
    <AppLayout title="Villages">
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-village-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Village
        </Button>
      </div>

      <FilterBar
        testId="villages-filter-bar"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search villages..."
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
