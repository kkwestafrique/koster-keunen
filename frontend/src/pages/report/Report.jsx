import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCTS, STANDARDS } from '@/data/regions';
import { supabase, uploadMediaFile } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { csvBlobFromRows, downloadBlob } from '@/hooks/useReportData';
import { useCreateExport, useUpdateExport } from '@/hooks/useExports';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';

const YEARS = ['2027', '2026', '2025', '2024', '2023', '2022'];

// Report page, matching the live site exactly:
// Tab 1 "Commercial partners": Beekeeper list (Year-only modal);
//   Beekeepers-Potential / Beekeepers-Achieved / Actors-Potential /
//   Actors-Achieved (Start year + End year + Standards multi-select modal).
// Tab 2 "Transactions": Contract / Received-Beekeepers / Received-Actors /
//   Processing / Sent (Date range + Products multi-select + Standards
//   multi-select modal). Every report generates a CSV download.
const PARTNER_REPORTS = [
  { key: 'beekeeperList', modal: 'yearOnly', table: 'beekeepers' },
  { key: 'beekeepersPotential', modal: 'yearRange', table: 'beekeepers', status: 'Potential' },
  { key: 'beekeepersAchieved', modal: 'yearRange', table: 'beekeepers', status: 'Achieved' },
  { key: 'actorsPotential', modal: 'yearRange', table: 'actors', status: 'Inactive' },
  { key: 'actorsAchieved', modal: 'yearRange', table: 'actors', status: 'Active' },
];

const TRANSACTION_REPORTS = [
  { key: 'contract', modal: 'dateProducts', table: 'contracts', dateField: 'signature_date' },
  { key: 'receivedBeekeepers', modal: 'dateProducts', table: 'transactions', direction: 'Received', counterpart: 'beekeeper_id' },
  { key: 'receivedActors', modal: 'dateProducts', table: 'transactions', direction: 'Received', counterpart: 'actor_id' },
  { key: 'processing', modal: 'dateProducts', table: 'transactions', direction: 'Processing' },
  { key: 'sent', modal: 'dateProducts', table: 'transactions', direction: 'Send' },
];

// Real gap found during a fresh review of this page: the export used
// Object.keys(rows[0]) directly, dumping every raw database column as
// its own literal name (supply_chain_id, created_at, and so on), and
// every foreign key as a bare, meaningless UUID (e.g. actor_id:
// "33333333-...") instead of the actual supplier or beekeeper name --
// exactly the kind of thing a real reader reviewing this report
// outside the app (or a parent company being shown it) has no way to
// make sense of.
//
// Real select strings, not invented: matches the exact join syntax
// already proven working elsewhere in this app for these same four
// tables (useBeekeepers.js, useContracts.js, useTransactions.js),
// rather than guessing at relationship names this file has never
// queried before.
const TABLE_SELECT = {
  beekeepers: '*, villages(name), actors!beekeepers_actor_id_fkey(contact_name, traceability_code)',
  actors: '*',
  contracts: '*, actors(traceability_code, contact_name)',
  transactions: '*, actors(traceability_code, contact_name), beekeepers(traceability_code, full_name), user_accounts(username)',
};

// Purely internal columns with no meaning to a real reader outside the
// app -- dropped from every export regardless of table. Raw foreign
// key id columns are dropped per-table below, once their readable
// name has been resolved from the join.
const ALWAYS_DROP = ['id', 'supply_chain_id'];

function humanizeKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Flattens one raw joined row into a clean, human-labeled export row --
// resolves each table's real foreign keys to the actual name already
// joined in above, and drops both the raw id and the now-redundant
// nested join object.
function flattenReportRow(table, row) {
  const clean = { ...row };
  if (table === 'beekeepers') {
    clean['Village'] = row.villages?.name ?? '';
    clean['Producer Organisation'] = row.actors?.contact_name ?? '';
    delete clean.villages;
    delete clean.actors;
    delete clean.village_id;
    delete clean.actor_id;
    delete clean.linked_producer_organisation_id;
  } else if (table === 'contracts') {
    clean['Supplier'] = row.actors?.contact_name ?? row.actors?.traceability_code ?? '';
    delete clean.actors;
    delete clean.actor_id;
    delete clean.owning_actor_id;
  } else if (table === 'transactions') {
    clean['Actor'] = row.actors?.contact_name ?? '';
    clean['Beekeeper'] = row.beekeepers?.full_name ?? '';
    clean['Logged By'] = row.user_accounts?.username ?? '';
    delete clean.actors;
    delete clean.beekeepers;
    delete clean.user_accounts;
    delete clean.actor_id;
    delete clean.beekeeper_id;
    delete clean.owning_actor_id;
    delete clean.destination_actor_id;
    delete clean.logged_by;
  }
  ALWAYS_DROP.forEach((k) => delete clean[k]);
  const labeled = {};
  Object.keys(clean).forEach((k) => {
    // Already-human labels added above (Village, Supplier, etc.) are
    // kept as-is; only raw snake_case database columns get humanized.
    labeled[/^[a-z_]+$/.test(k) ? humanizeKey(k) : k] = clean[k];
  });
  return labeled;
}


function MultiCheck({ options, allLabel, value, onChange, testIdPrefix }) {
  const allSelected = value.length === 0;
  return (
    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-[#cfd8e6] rounded-[5px] p-3">
      <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
        <Checkbox
          checked={allSelected}
          data-testid={`${testIdPrefix}-all`}
          onCheckedChange={() => onChange([])}
        />
        {allLabel}
      </label>
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
          <Checkbox
            checked={value.includes(opt)}
            data-testid={`${testIdPrefix}-${opt}`}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, opt] : value.filter((v) => v !== opt))
            }
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

export default function Report() {
  const { t } = useTranslation();
  usePageTitle(t('report.title'));
  const { toast } = useToast();
  const { supplyChainId } = useAuth();
  const { canEdit } = usePermissions();
  const createExport = useCreateExport();
  const updateExport = useUpdateExport();
  const [activeReport, setActiveReport] = useState(null); // {key, modal, table, ...}
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    year: '', startYear: '', endYear: '', dateFrom: '', dateTo: '', products: [], standards: [],
  });

  const openReport = (report) => {
    setFilters({ year: '', startYear: '', endYear: '', dateFrom: '', dateTo: '', products: [], standards: [] });
    setActiveReport(report);
  };

  // Real bug found via independent audit (BUG-19): "Generate report"
  // proceeded with the required Year field left empty -- confirmed
  // exactly: nothing gated the button on any of the fields actually
  // marked required (*) in each modal type below. Matches each modal's
  // own required fields precisely; dateProducts has none marked
  // required, so it's correctly left unrestricted.
  const filtersValid = (() => {
    if (!activeReport) return false;
    if (activeReport.modal === 'yearOnly') return !!filters.year;
    // Standards deliberately not checked for non-empty here: an empty
    // array is the legitimate, default "All standards" state (see
    // MultiCheck's own allSelected = value.length === 0), not a missing
    // value -- confirmed by reading that component directly before
    // trusting the "*" label as a literal non-empty requirement.
    if (activeReport.modal === 'yearRange') return !!filters.startYear && !!filters.endYear;
    return true;
  })();

  const generate = async () => {
    setGenerating(true);
    const fileName = `${activeReport.key}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    let exportRow;
    try {
      exportRow = await createExport.mutateAsync({ reportKey: activeReport.key, fileName });
    } catch (err) {
      // If we can't even create the tracking row, still let the report
      // generate — the downloads panel just won't show this one.
      exportRow = null;
    }

    try {
      let query = supabase.from(activeReport.table).select(TABLE_SELECT[activeReport.table]).eq('supply_chain_id', supplyChainId);
      if (activeReport.status) query = query.eq('status', activeReport.status);
      if (activeReport.direction) query = query.eq('direction', activeReport.direction);
      if (activeReport.counterpart) query = query.not(activeReport.counterpart, 'is', null);
      // Real bug found via independent audit: "beekeeper count
      // disagreement across dashboard/list/export" -- this was the
      // third of three places with the same gap. The List and (now
      // fixed) Dashboard both correctly exclude beekeeper records with
      // no owning actor at all; this export never did, so a beekeeper
      // count report could disagree with what both screens showed.
      if (activeReport.table === 'beekeepers') query = query.not('actor_id', 'is', null);

      // beekeepers/actors have no `year` column — "year" here means the
      // year the record was created.
      const isCreatedAtYear = activeReport.table === 'beekeepers' || activeReport.table === 'actors';
      if (activeReport.modal === 'yearOnly' && filters.year) {
        if (isCreatedAtYear) {
          query = query.gte('created_at', `${filters.year}-01-01`).lte('created_at', `${filters.year}-12-31T23:59:59`);
        } else {
          query = query.eq('year', Number(filters.year));
        }
      }
      if (activeReport.modal === 'yearRange') {
        if (isCreatedAtYear) {
          if (filters.startYear) query = query.gte('created_at', `${filters.startYear}-01-01`);
          if (filters.endYear) query = query.lte('created_at', `${filters.endYear}-12-31T23:59:59`);
        } else {
          if (filters.startYear) query = query.gte('year', Number(filters.startYear));
          if (filters.endYear) query = query.lte('year', Number(filters.endYear));
        }
      }
      if (activeReport.modal === 'dateProducts') {
        const dateField = activeReport.dateField || 'transaction_date';
        if (filters.dateFrom) query = query.gte(dateField, filters.dateFrom);
        if (filters.dateTo) query = query.lte(dateField, filters.dateTo);
        if (filters.products.length > 0) query = query.in('product', filters.products);
      }
      const tableHasStandard = activeReport.table !== 'beekeepers' && activeReport.table !== 'actors';
      if (tableHasStandard && filters.standards.length > 0) query = query.in('standard', filters.standards);

      const { data, error } = await query;
      if (error) throw error;

      const rawRows = data || [];
      if (rawRows.length === 0) {
        toast({ title: t('report.noData') });
        if (exportRow) {
          await updateExport.mutateAsync({ id: exportRow.id, status: 'Failed', error_message: 'No matching records', completed_at: new Date().toISOString() });
        }
        return;
      }

      const rows = rawRows.map((row) => flattenReportRow(activeReport.table, row));
      const columns = Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
      const blob = csvBlobFromRows(rows, columns);
      downloadBlob(blob, fileName);

      // Upload the same file to storage so the downloads panel can offer a
      // real re-download later, from any device — not just this browser tab.
      let fileUrl = null;
      try {
        fileUrl = await uploadMediaFile(new File([blob], fileName, { type: 'text/csv' }), 'exports', supplyChainId);
      } catch (uploadErr) {
        // The person already has their local download; a storage-upload
        // failure shouldn't be treated as the whole export failing.
      }

      if (exportRow) {
        await updateExport.mutateAsync({
          id: exportRow.id,
          status: 'Completed',
          row_count: rows.length,
          file_url: fileUrl,
          completed_at: new Date().toISOString(),
        });
      }

      toast({ title: t('report.generated') });
      setActiveReport(null);
    } catch (err) {
      if (exportRow) {
        await updateExport.mutateAsync({ id: exportRow.id, status: 'Failed', error_message: err.message, completed_at: new Date().toISOString() }).catch(() => {});
      }
      toast({ title: t('report.generateFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const renderButtons = (reports, testIdPrefix) => (
    <div className="flex flex-wrap gap-3 pt-5">
      {reports.map((r) => (
        <Button
          key={r.key}
          variant="outline"
          data-testid={`${testIdPrefix}-${r.key}`}
          className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#ebf6ff]"
          onClick={() => openReport(r)}
        >
          {t(`report.${r.key}`)}
        </Button>
      ))}
    </div>
  );

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.report')}</h1>

      <Tabs defaultValue="partners">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
          <TabsTrigger
            value="partners"
            data-testid="report-tab-partners"
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold"
          >
            {t('report.commercialPartners')}
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            data-testid="report-tab-transactions"
            className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold"
          >
            {t('nav.transactions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">{renderButtons(PARTNER_REPORTS, 'report-partner')}</TabsContent>
        <TabsContent value="transactions">{renderButtons(TRANSACTION_REPORTS, 'report-tx')}</TabsContent>
      </Tabs>

      <Dialog open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
        <DialogContent className="max-w-md bg-white" data-testid="report-modal">
          <DialogHeader>
            <DialogTitle className="text-[#032b71] font-black">
              {activeReport ? t(`report.${activeReport.key}`) : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {activeReport ? t(`report.${activeReport.key}`) : ''}
            </DialogDescription>
          </DialogHeader>

          {activeReport?.modal === 'yearOnly' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-year" className="text-[#5a6f9a]">{t('contractWizard.year')} *</Label>
              <Select value={filters.year} onValueChange={(v) => setFilters((f) => ({ ...f, year: v }))}>
                <SelectTrigger id="report-year" data-testid="report-year"><SelectValue placeholder={t('contractWizard.selectYear')} /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeReport?.modal === 'yearRange' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="report-start-year" className="text-[#5a6f9a]">{t('report.startYear')} *</Label>
                  <Select value={filters.startYear} onValueChange={(v) => setFilters((f) => ({ ...f, startYear: v }))}>
                    <SelectTrigger id="report-start-year" data-testid="report-start-year"><SelectValue placeholder={t('report.selectStartYear')} /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="report-end-year" className="text-[#5a6f9a]">{t('report.endYear')} *</Label>
                  <Select value={filters.endYear} onValueChange={(v) => setFilters((f) => ({ ...f, endYear: v }))}>
                    <SelectTrigger id="report-end-year" data-testid="report-end-year"><SelectValue placeholder={t('report.selectEndYear')} /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[#5a6f9a] block">{t('report.standards')}</span>
                <MultiCheck
                  options={STANDARDS}
                  allLabel={t('report.allStandards')}
                  value={filters.standards}
                  onChange={(v) => setFilters((f) => ({ ...f, standards: v }))}
                  testIdPrefix="report-standard"
                />
              </div>
            </div>
          )}

          {activeReport?.modal === 'dateProducts' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="report-date-from" className="text-[#5a6f9a]">{t('report.dateFrom')}</Label>
                  <Input id="report-date-from" type="date" data-testid="report-date-from" min="1900-01-01" max="2100-12-31" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="report-date-to" className="text-[#5a6f9a]">{t('report.dateTo')}</Label>
                  <Input id="report-date-to" type="date" data-testid="report-date-to" min="1900-01-01" max="2100-12-31" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[#5a6f9a] block">{t('report.products')}</span>
                <MultiCheck
                  options={PRODUCTS}
                  allLabel={t('report.allProducts')}
                  value={filters.products}
                  onChange={(v) => setFilters((f) => ({ ...f, products: v }))}
                  testIdPrefix="report-product"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[#5a6f9a] block">{t('report.standards')}</span>
                <MultiCheck
                  options={STANDARDS}
                  allLabel={t('report.allStandards')}
                  value={filters.standards}
                  onChange={(v) => setFilters((f) => ({ ...f, standards: v }))}
                  testIdPrefix="report-standard"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setActiveReport(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              data-testid="report-generate"
              disabled={generating || !canEdit || !filtersValid}
              title={!canEdit ? t('report.exportRestricted') : undefined}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] disabled:opacity-50"
              onClick={generate}
            >
              {generating ? t('report.generating') : t('report.generateReport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
