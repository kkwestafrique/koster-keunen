import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import DataTable from '@/components/common/DataTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Database } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// Vibe-coding-checklist gaps closed: "Build an admin panel. Early. One
// screen to manage users, master data, menus, records." and "One
// click. Whole database. Export everything as SQL or Excel, anytime."
// Neither existed before -- team/villages management was scattered
// across regular nav pages, and Reports/Exports only ever produced
// scoped exports, never a full dump.
//
// Gated on profile.is_system_admin (a new, narrow, manually-granted
// flag -- see migration add_system_admin_flag), not the existing
// per-actor Admin role. Every actor already has "Admin" team members;
// this page shows data across every actor in the supply chain, which
// is exactly the actor-isolation violation this whole project has been
// built to prevent if it were gated on the wrong role. The route itself
// is still protected by ProtectedRoute like every other page -- this
// component additionally refuses to render its content for anyone
// without the flag, and the actual cross-actor reads for the Database
// tab happen through export-full-database (service-role-backed, checks
// this same flag server-side) rather than through the regular
// RLS-scoped client, which would correctly refuse this much visibility
// to a normal session.

function useAllTeamMembers() {
  return useQuery({
    queryKey: ['admin', 'all-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email, role, status, created_at, actors(traceability_code, contact_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useAllVillages() {
  return useQuery({
    queryKey: ['admin', 'all-villages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('villages')
        .select('id, name, country, state_region, lga_municipality')
        .order('country', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

function UsersTab() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useAllTeamMembers();
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-[#0f48aa]" />;
  return (
    <DataTable
      columns={[
        { key: 'name', label: t('adminPanel.name') },
        { key: 'email', label: t('adminPanel.email') },
        { key: 'actor', label: t('adminPanel.actor'), render: (r) => r.actors ? `${r.actors.traceability_code} — ${r.actors.contact_name}` : '—' },
        { key: 'role', label: t('adminPanel.role') },
        { key: 'status', label: t('adminPanel.status') },
      ]}
      rows={data}
      total={data.length}
      page={1}
      pageSize={Math.max(data.length, 1)}
      testId="admin-users-table"
    />
  );
}

function MasterDataTab() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useAllVillages();
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-[#0f48aa]" />;
  return (
    <div>
      <p className="text-sm text-[#5a6f9a] mb-3">{t('adminPanel.masterDataHint')}</p>
      <DataTable
        columns={[
          { key: 'name', label: t('forms.village') },
          { key: 'lga_municipality', label: t('forms.lga') },
          { key: 'state_region', label: t('forms.stateRegion') },
          { key: 'country', label: t('forms.country') },
        ]}
        rows={data}
        total={data.length}
        page={1}
        pageSize={Math.max(data.length, 1)}
        testId="admin-master-data-table"
      />
    </div>
  );
}

function toSqlValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildSqlDump(tables) {
  const lines = [`-- KKWA MIS full database export`, `-- Generated ${new Date().toISOString()}`, ''];
  for (const [table, rows] of Object.entries(tables)) {
    if (!rows.length) continue;
    lines.push(`-- ${table} (${rows.length} rows)`);
    const columns = Object.keys(rows[0]);
    for (const row of rows) {
      const values = columns.map((c) => toSqlValue(row[c])).join(', ');
      lines.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values});`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DatabaseTab() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(null);

  const runExport = async (format) => {
    setExporting(format);
    try {
      const { data, error } = await supabase.functions.invoke('export-full-database');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const dateStamp = new Date().toISOString().slice(0, 10);
      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        for (const [table, rows] of Object.entries(data.tables)) {
          const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ [table]: 'no rows' }]);
          XLSX.utils.book_append_sheet(wb, sheet, table.slice(0, 31));
        }
        XLSX.writeFile(wb, `kkwa-database-export-${dateStamp}.xlsx`);
      } else {
        const sql = buildSqlDump(data.tables);
        downloadFile(sql, `kkwa-database-export-${dateStamp}.sql`, 'text/plain');
      }
      toast({ title: t('adminPanel.exportComplete') });
    } catch (err) {
      toast({ title: t('adminPanel.exportFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="text-sm text-[#5a6f9a] mb-4">{t('adminPanel.databaseHint')}</p>
      <div className="flex gap-3">
        <Button
          type="button"
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
          disabled={!!exporting}
          onClick={() => runExport('xlsx')}
          data-testid="admin-export-xlsx"
        >
          {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} {t('adminPanel.exportXlsx')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-[#0f48aa] text-[#0f48aa]"
          disabled={!!exporting}
          onClick={() => runExport('sql')}
          data-testid="admin-export-sql"
        >
          {exporting === 'sql' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} {t('adminPanel.exportSql')}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { t } = useTranslation();
  usePageTitle(t('nav.admin'));
  const { profile } = useAuth();

  if (!profile?.is_system_admin) {
    return (
      <AppLayout>
        <p className="text-sm text-[#5a6f9a]" data-testid="admin-not-authorized">{t('adminPanel.notAuthorized')}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="text-lg font-black text-[#0f48aa] mb-1 flex items-center gap-2">
        <Database className="h-5 w-5" /> {t('nav.admin')}
      </h1>
      <p className="text-sm text-[#5a6f9a] mb-4">{t('adminPanel.pageHint')}</p>
      <Tabs defaultValue="users">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start mb-4">
          <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:text-[#0f48aa] pb-2 px-0" data-testid="admin-tab-users">
            {t('adminPanel.usersTab')}
          </TabsTrigger>
          <TabsTrigger value="master-data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:text-[#0f48aa] pb-2 px-0" data-testid="admin-tab-master-data">
            {t('adminPanel.masterDataTab')}
          </TabsTrigger>
          <TabsTrigger value="database" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:text-[#0f48aa] pb-2 px-0" data-testid="admin-tab-database">
            {t('adminPanel.databaseTab')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="master-data"><MasterDataTab /></TabsContent>
        <TabsContent value="database"><DatabaseTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
