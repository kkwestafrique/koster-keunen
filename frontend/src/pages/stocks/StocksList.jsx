import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { useStocks } from '@/hooks/useStocks';
import { useConstants } from '@/hooks/useConstants';
import { useAllVillagesLite } from '@/hooks/useVillages';

// Shared list for Stocks > Raw material / Final product / Loss.
export default function StocksList({ stockType, title, actionLabel, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [standard, setStandard] = useState('');
  const [village, setVillage] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  const { data: products = [] } = useConstants('product_type');
  const { data: standards = [] } = useConstants('standard');
  const { data: villages = [] } = useAllVillagesLite();

  const { data, isLoading } = useStocks({ stockType, page, search, product, standard, village, date });
  const rows = data?.rows || [];

  // Per the live-site audit: only Raw material supports Receive stock.
  // Final product and Loss are read-only lists with Select/Select all
  // actions instead of any Add/Create button.
  const canReceive = stockType === 'Raw Material';

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(rows.map((r) => r.id));
    });

  const columns = [
    ...(!canReceive
      ? [{
          key: '__select',
          label: (
            <Checkbox
              data-testid={`${testId}-select-all`}
              checked={allSelected}
              onCheckedChange={toggleAll}
              onClick={(e) => e.stopPropagation()}
            />
          ),
          render: (row) => (
            <Checkbox
              data-testid={`${testId}-select-${row.id}`}
              checked={selected.has(row.id)}
              onCheckedChange={() => toggleRow(row.id)}
              onClick={(e) => e.stopPropagation()}
            />
          ),
        }]
      : []),
    { key: 'id', label: t('stocks.stockId'), render: (row) => String(row.id).slice(0, 8) },
    { key: 'batch_reference', label: t('stocks.batch') },
    { key: 'product', label: t('stocks.product') },
    {
      key: 'standard',
      label: t('stocks.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    {
      key: 'village',
      label: t('receiveForm.village'),
      render: (row) => row.villages?.name || '—',
    },
    {
      key: 'quantity_available',
      label: t('stocks.quantityAvailable'),
      render: (row) => (row.quantity_available != null ? `${row.quantity_available} ${row.unit || ''}` : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title}</h1>
        {canReceive && (
          <Button
            data-testid={`${testId}-action-button`}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            onClick={() => navigate('/transactions/received/new')}
          >
            <Plus className="h-4 w-4 mr-1" /> {actionLabel}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FilterBar
          testId={testId}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder={t('actorsList.searchPlaceholder')}
          filters={[
            {
              key: 'product',
              label: t('stocks.allProducts'),
              value: product,
              onChange: (v) => { setProduct(v); setPage(1); },
              options: products.map((p) => ({ value: p.value, label: p.label })),
            },
            {
              key: 'standard',
              label: t('stocks.allStandards'),
              value: standard,
              onChange: (v) => { setStandard(v); setPage(1); },
              options: standards.map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: 'village',
              label: t('stocks.allVillages'),
              value: village,
              onChange: (v) => { setVillage(v); setPage(1); },
              options: villages.map((v) => ({ value: v.id, label: v.name })),
            },
          ]}
        />
        <Input
          type="date"
          data-testid={`${testId}-date-filter`}
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          placeholder={t('stocks.selectDate')}
          className="w-[160px] bg-white border-[#cfd8e6] text-[#032b71]"
        />
      </div>

      {!canReceive && selected.size > 0 && (
        <p className="text-sm text-[#7089b4] mb-2" data-testid={`${testId}-selected-count`}>
          {selected.size} {t('stocks.select').toLowerCase()}ed
        </p>
      )}

      <DataTable
        testId={testId}
        columns={columns}
        rows={rows}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
