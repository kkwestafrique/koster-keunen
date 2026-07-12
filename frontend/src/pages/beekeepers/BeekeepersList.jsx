import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useAllVillagesLite } from '@/hooks/useVillages';
import BeekeeperFormDialog from '@/pages/beekeepers/BeekeeperFormDialog';

// fixedStatus: 'Potential' | 'Actual' | null (full list)
export default function BeekeepersList({ fixedStatus, title, testId }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [villageId, setVillageId] = useState('');
  const [year, setYear] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();

  const { data: villages = [] } = useAllVillagesLite();

  const { data, isLoading } = useBeekeepers({
    page,
    search,
    gender,
    villageId,
    status: fixedStatus || '',
    year,
  });

  const columns = [
    { key: 'traceability_code', label: t('beekeepersList.traceabilityCode') },
    { key: 'full_name', label: t('beekeepersList.fullName') },
    { key: 'gender', label: t('beekeepersList.gender') },
    { key: 'village', label: t('beekeepersList.village'), render: (row) => row.villages?.name || '—' },
    { key: 'traditional_single', label: t('beekeepersList.traditionalSingle'), render: (row) => row.hives_traditional_single ?? 0 },
    { key: 'traditional_double', label: t('beekeepersList.traditionalDouble'), render: (row) => row.hives_traditional_double ?? 0 },
    { key: 'modern_hives', label: t('beekeepersList.modernHives'), render: (row) => row.hives_modern ?? 0 },
    { key: 'other', label: t('beekeepersList.other'), render: (row) => row.hives_other ?? 0 },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title || t('beekeepersList.title')}</h1>
        <Button
          data-testid="add-beekeeper-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> {t('beekeepersList.addBeekeeper')}
        </Button>
      </div>

      <FilterBar
        testId={testId}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={t('actorsList.searchPlaceholder')}
        filters={[
          {
            key: 'village',
            label: t('beekeepersList.allVillages'),
            value: villageId,
            onChange: (v) => { setVillageId(v); setPage(1); },
            options: villages.map((v) => ({ value: v.id, label: v.name })),
          },
          {
            key: 'year',
            label: t('beekeepersList.allYear'),
            value: year,
            onChange: (v) => { setYear(v); setPage(1); },
            options: ['2026', '2025', '2024'].map((y) => ({ value: y, label: y })),
          },
          {
            key: 'gender',
            label: t('beekeepersList.allGender'),
            value: gender,
            onChange: (v) => { setGender(v); setPage(1); },
            options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }],
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
        onRowClick={(row) => navigate(`/beekeepers/${row.id}`)}
      />

      <BeekeeperFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </AppLayout>
  );
}
