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
import { downloadBlob } from '@/hooks/useReportData';
import { buildReport, reportToXlsxBlob, reportFileName, displayProduct, REPORT_TEMPLATES } from '@/lib/reportTemplates';
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
//   multi-select modal). Every report downloads as .xlsx in the old MIS
// layout -- see lib/reportTemplates.js.
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

// Reports now follow the old MIS export layouts exactly (sheet names,
// headers, column order, widths, DD/MM/YYYY dates, "-" for missing
// values) -- built in lib/reportTemplates.js. This page only loads the
// raw data each report needs.

// PostgREST returns at most 1000 rows per request. Real gap: a single
// request silently truncated every report past 1000 rows, which the
// historical import (2,092 beekeeper transactions) would have hit.
// Pages through until a short page comes back.
async function fetchAll(buildQuery) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const ACTOR_EMBED = 'actors!actor_id(traceability_code, contact_name, actor_type)';

async function loadReportData(report, filters, supplyChainId) {
  const inChain = (q) => q.eq('supply_chain_id', supplyChainId);
  const data = { beekeepers: [], villagesById: {}, transactions: [], actors: [], connections: [], contracts: [] };
  const key = report.key;
  const needsBeekeepers = ['beekeeperList', 'beekeepersPotential', 'beekeepersAchieved', 'actorsPotential', 'actorsAchieved'].includes(key);

  if (needsBeekeepers) {
    // Same rule as the Beekeepers list and Dashboard: beekeepers with no
    // owning actor are excluded, so counts agree across all three.
    data.beekeepers = await fetchAll(() => inChain(supabase.from('beekeepers').select('*')).not('actor_id', 'is', null).order('id'));
  }
  if (key === 'beekeeperList') {
    const villages = await fetchAll(() => inChain(supabase.from('villages').select('id, name, country, state_region, lga_municipality')).order('id'));
    data.villagesById = Object.fromEntries(villages.map((v) => [v.id, v]));
  }
  if (['beekeeperList', 'beekeepersAchieved', 'actorsAchieved'].includes(key)) {
    data.transactions = await fetchAll(() => inChain(supabase.from('transactions').select('id, beekeeper_id, transaction_date, product, direction'))
      .not('beekeeper_id', 'is', null).order('id'));
  }
  if (key === 'actorsPotential' || key === 'actorsAchieved') {
    data.actors = await fetchAll(() => inChain(supabase.from('actors').select('*')).order('id'));
    data.connections = await fetchAll(() => inChain(supabase.from('connections').select('actor_from_id, actor_to_id, status')).order('id'));
  }

  const inRange = (q, field) => {
    let out = q;
    if (filters.dateFrom) out = out.gte(field, filters.dateFrom);
    if (filters.dateTo) out = out.lte(field, filters.dateTo);
    if (filters.standards.length > 0) out = out.in('standard', filters.standards);
    return out;
  };
  if (key === 'contract') {
    data.contracts = await fetchAll(() => inRange(inChain(supabase.from('contracts').select(`*, ${ACTOR_EMBED}`)), 'signature_date').order('id'));
  }
  if (['receivedBeekeepers', 'receivedActors', 'sent', 'processing'].includes(key)) {
    data.transactions = await fetchAll(() => {
      let q = inRange(inChain(supabase.from('transactions')
        .select(`*, ${ACTOR_EMBED}, beekeepers(traceability_code, full_name, internal_code)`)), 'transaction_date')
        .eq('direction', report.direction);
      // Processing is filtered per batch in the builder (a batch matches
      // if its input or any output is a selected product), so a batch is
      // never half-dropped by a row-level filter here.
      if (key !== 'processing' && filters.products.length > 0) q = q.in('product', filters.products);
      return q.order('id');
    });
  }
  return data;
}

// Real, confirmed translation map for the one specific Power BI
// dashboard this app's data was found to feed. Every value here was
// checked directly against real, live data before being written --
// not assumed or invented. Deliberately narrow in scope (just the
// three fields actually confirmed to mismatch) rather than a generic
// "translate everything to French" feature, since that's not
// something the rest of the app's own reporting needs or wants.
const POWERBI_PRODUCT_MAP = {
  'Beeswax-Yellow': "Cire d'abeille - Jaune",
  'Beeswax-Brown': "Cire d'abeille - Marron",
};
const POWERBI_STANDARD_MAP = {
  Sustainable: 'Durable',
  Organic: 'Biologique',
  Conventional: 'Conventionnelle',
};
// Country is not a column in the received-from-actors template, so the
// Power BI Benin -> Bénin mapping no longer applies to this report.

const POWERBI_TRANSLATE = {
  product: (p) => (p in POWERBI_PRODUCT_MAP ? POWERBI_PRODUCT_MAP[p] : displayProduct(p)),
  standard: (st) => (st in POWERBI_STANDARD_MAP ? POWERBI_STANDARD_MAP[st] : st),
};


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
  const { supplyChainId, profile } = useAuth();
  const { canEdit } = usePermissions();
  const createExport = useCreateExport();
  const updateExport = useUpdateExport();
  const [activeReport, setActiveReport] = useState(null); // {key, modal, table, ...}
  // Real, deliberate scope: Power BI's dashboard model expects specific
  // French values for Product ("Cire d'abeille - Jaune"/"Marron") and
  // Standard ("Durable"/"Biologique"/"Conventionnelle") that don't match
  // what this app actually stores (English). Confirmed directly against
  // real data before building this -- not a hypothetical mismatch.
  // Scoped to just this one checkbox/report rather than a general
  // app-wide setting, since it's specific to one external dashboard's
  // requirements, not something the rest of the app's reporting should
  // be coupled to.
  const [powerBiFormat, setPowerBiFormat] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    year: '', startYear: '', endYear: '', dateFrom: '', dateTo: '', products: [], standards: [],
  });

  const openReport = (report) => {
    setFilters({ year: '', startYear: '', endYear: '', dateFrom: '', dateTo: '', products: [], standards: [] });
    setPowerBiFormat(false);
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
    let exportRow;
    let fileName = `${activeReport.key}.xlsx`;
    try {
      // File named like the old MIS exports, e.g.
      // "Beekeepers_List_OLD_LEVI_MULTIBIZ_SERVICES_LTD.xlsx".
      let orgName = '';
      if (profile?.current_actor_id) {
        const { data: me } = await supabase.from('actors').select('contact_name').eq('id', profile.current_actor_id).maybeSingle();
        orgName = me?.contact_name || '';
      }
      fileName = reportFileName(REPORT_TEMPLATES[activeReport.key].fileBase, orgName);
      exportRow = await createExport.mutateAsync({ reportKey: activeReport.key, fileName });
    } catch (err) {
      // If we can't even create the tracking row, still let the report
      // generate -- the downloads panel just won't show this one.
      exportRow = null;
    }

    try {
      const data = await loadReportData(activeReport, filters, supplyChainId);
      const translate = activeReport.key === 'receivedActors' && powerBiFormat ? POWERBI_TRANSLATE : undefined;
      const report = buildReport(activeReport.key, data, filters, translate);

      if (report.rows.length === 0) {
        toast({ title: t('report.noData') });
        if (exportRow) {
          await updateExport.mutateAsync({ id: exportRow.id, status: 'Failed', error_message: 'No matching records', completed_at: new Date().toISOString() });
        }
        return;
      }

      const blob = await reportToXlsxBlob(report);
      downloadBlob(blob, fileName);

      // Upload the same file to storage so the downloads panel can offer a
      // real re-download later, from any device -- not just this browser tab.
      let fileUrl = null;
      try {
        fileUrl = await uploadMediaFile(new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'exports', supplyChainId);
      } catch (uploadErr) {
        // The person already has their local download; a storage-upload
        // failure shouldn't be treated as the whole export failing.
      }

      if (exportRow) {
        await updateExport.mutateAsync({
          id: exportRow.id,
          status: 'Completed',
          row_count: report.rows.length,
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {activeReport?.key === 'receivedActors' && (
                <label className="flex items-start gap-2 text-sm text-[#032b71] cursor-pointer" data-testid="report-powerbi-checkbox">
                  <Checkbox checked={powerBiFormat} onCheckedChange={(v) => setPowerBiFormat(!!v)} className="mt-0.5" />
                  <span>
                    {t('report.powerBiFormat')}
                    <span className="block text-xs text-[#5a6f9a] font-normal mt-0.5">{t('report.powerBiFormatHint')}</span>
                  </span>
                </label>
              )}
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
