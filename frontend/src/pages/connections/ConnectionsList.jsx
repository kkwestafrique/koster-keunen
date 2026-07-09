import React, { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Check, X } from 'lucide-react';
import { useConnections } from '@/hooks/useConnections';
import ConnectionFormDialog from '@/pages/connections/ConnectionFormDialog';

const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => {
  const y = new Date().getFullYear() - i;
  return { value: String(y), label: String(y) };
});

export default function ConnectionsList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useConnections({ page, search, status, year });

  const columns = [
    { key: 'actor_from', label: 'Actor From', render: (row) => row.actor_from?.contact_name || '—' },
    { key: 'actor_to', label: 'Actor To', render: (row) => row.actor_to?.contact_name || '—' },
    { key: 'connection_type', label: 'Type' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'year', label: 'Year' },
    {
      key: 'is_supplier',
      label: 'Supplier',
      render: (row) => (row.is_supplier ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#7089b4]" />),
    },
    {
      key: 'is_buyer',
      label: 'Buyer',
      render: (row) => (row.is_buyer ? <Check className="h-4 w-4 text-[#219653]" /> : <X className="h-4 w-4 text-[#7089b4]" />),
    },
  ];

  return (
    <AppLayout title="Connections">
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button
          data-testid="add-connection-button"
          onClick={() => setFormOpen(true)}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Connection
        </Button>
      </div>

      <FilterBar
        testId="connections-filter-bar"
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by actor name or code..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [{ value: 'Active', label: 'Active' }, { value: 'Revoked', label: 'Revoked' }],
          },
          {
            key: 'year',
            label: 'Year',
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
