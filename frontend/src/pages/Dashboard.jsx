import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite, useActorTypeCounts } from '@/hooks/useActors';
import { useBeekeeperAggregates } from '@/hooks/useBeekeepers';
import { useDashboardTransactionSummary } from '@/hooks/useTransactions';
import { useCountries } from '@/hooks/useReferenceData';
import { COUNTRIES } from '@/data/regions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useContractYears } from '@/hooks/useContracts';
import { useSeasonMetrics } from '@/hooks/useSeasonMetrics';
import { useSeasonPurchases } from '@/hooks/useSeasonPurchases';
import { useSeasonMonthly } from '@/hooks/useSeasonMonthly';
import { useSeasonStocks } from '@/hooks/useSeasonStocks';
import { useIndicatorsQuality } from '@/hooks/useIndicatorsQuality';
import { useIndicatorsYearly } from '@/hooks/useIndicatorsYearly';
import { useIndicatorsLocalPartners } from '@/hooks/useIndicatorsLocalPartners';
import GaugeCard from '@/components/common/GaugeCard';

function StatCard({ label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center flex-1"
    >
      <span className="text-[28px] font-bold text-[#032b71]">{value ?? '—'}</span>
      <span className="text-xs text-[#5a6f9a]">{label}</span>
    </div>
  );
}

function ChartCard({ title, controls, children, testId, isEmpty }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex-1 min-w-[300px]"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#032b71]">{title}</h3>
        {controls}
      </div>
      {/* Real bug found via independent audit (BUG-33): a chart with
          zero real data rendered as a blank card with no visible
          content and no explanation -- indistinguishable from a
          loading state or a genuine bug. Fixed once here, shared by
          every chart on this page. */}
      {/* Real gap found via independent audit (A1): SVG charts had no
          accessible name at all -- a screen reader announces raw,
          meaningless SVG markup instead of what the chart actually
          shows. Wrapping the real chart content (not the empty-state
          text, which is already plain, readable text) in role="img"
          with the same title already shown visually tells assistive
          tech to treat the whole chart as one described image rather
          than trying to narrate its internal SVG structure. Fixed once
          here, shared by every chart on this page. */}
      {isEmpty ? (
        <div className="flex items-center justify-center h-[260px] text-sm text-[#5a6f9a]" data-testid={`${testId}-empty`}>
          {t('common.noDataAvailable')}
        </div>
      ) : (
        <div role="img" aria-label={typeof title === 'string' ? title : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

const ACTOR_TYPE_COLORS = {
  'Producer Organisation': '#0f48aa',
  Aggregator: '#2d9cdb',
  'Local Partner': '#6fcf97',
  Buyer: '#f2c94c',
};

const HIVE_COLORS = { Traditional: '#0f48aa', Modern: '#9fb6dd', Other: '#c5cae9' };
const GENDER_COLORS = { Male: '#0f48aa', Female: '#9fb6dd', Other: '#219653' };

const CATEGORY_TRANSLATION_KEY = {
  'Producer Organisation': 'dashboard.categoryProducerOrganisation',
  Aggregator: 'dashboard.categoryAggregator',
  'Local Partner': 'dashboard.categoryLocalPartner',
  Buyer: 'dashboard.categoryBuyer',
  Traditional: 'dashboard.categoryTraditional',
  Modern: 'dashboard.categoryModern',
  Other: 'dashboard.categoryOther',
  Male: 'dashboard.categoryMale',
  Female: 'dashboard.categoryFemale',
};

export default function Dashboard() {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const { profile } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const [tab, setTab] = useState('supply');
  const [country, setCountry] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [year, setYear] = useState('2026');
  const { data: contractYears = [] } = useContractYears();
  // Always include the current default even before the query resolves,
  // and even if there happen to be zero contracts yet for some year.
  const yearOptions = [...new Set([2026, 2025, 2024, ...contractYears])].sort((a, b) => b - a);

  const { data: actorCounts } = useActorTypeCounts({ country });
  const { data: bkAgg } = useBeekeeperAggregates({ country });
  const { data: txSummary } = useDashboardTransactionSummary({ year });
  const { data: seasonMetrics } = useSeasonMetrics({ year });
  const { data: seasonPurchases } = useSeasonPurchases({ year });
  const { data: seasonMonthly } = useSeasonMonthly({ year });
  const { data: seasonStocks } = useSeasonStocks({ year });
  const { data: indicatorsQuality } = useIndicatorsQuality({ year });
  const { data: indicatorsYearly } = useIndicatorsYearly();
  const { data: indicatorsLocalPartners } = useIndicatorsLocalPartners({ year });
  const { data: countries = [] } = useCountries();

  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  const actorTypeData = actorCounts
    ? Object.entries(actorCounts.byType)
        .filter(([name, v]) => v > 0 && (!actorFilter || name === actorFilter))
        .map(([name, value]) => ({ name, translatedName: t(CATEGORY_TRANSLATION_KEY[name] || name), value }))
    : [];

  const hiveData = bkAgg
    ? [
        { name: 'Traditional', translatedName: t('dashboard.categoryTraditional'), value: bkAgg.traditional },
        { name: 'Modern', translatedName: t('dashboard.categoryModern'), value: bkAgg.modern },
        { name: 'Other', translatedName: t('dashboard.categoryOther'), value: bkAgg.other },
      ].filter((d) => d.value > 0)
    : [];

  const genderData = bkAgg
    ? [
        { name: 'Male', translatedName: t('dashboard.categoryMale'), value: bkAgg.male },
        { name: 'Female', translatedName: t('dashboard.categoryFemale'), value: bkAgg.female },
        { name: 'Other', translatedName: t('dashboard.categoryOther'), value: bkAgg.genderOther },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AppLayout hideDefaultHeader>
      <div className="bg-[#f9fafc] px-0 -m-8 mb-0 pb-8">
        {/* Header block */}
        <div className="bg-[#f9fafc] px-8 py-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-black text-[#0f48aa]" data-testid="dashboard-title">
              {t('dashboard.title')}
            </h1>
            <p className="text-[15px] text-[#032b71]" data-testid="dashboard-welcome">
              {t('dashboard.greeting', {
                name: profile?.username || 'there',
                company: currentActor?.contact_name || 'your organisation',
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <StatCard
              label={t('dashboard.localPartners')}
              value={actorCounts?.byType?.['Local Partner']}
              testId="stat-local-partners"
            />
            <StatCard
              label={t('dashboard.aggregators')}
              value={actorCounts?.byType?.Aggregator}
              testId="stat-aggregators"
            />
            <StatCard
              label={t('dashboard.producerOrganisations')}
              value={actorCounts?.byType?.['Producer Organisation']}
              testId="stat-producer-orgs"
            />
            <StatCard label={t('dashboard.beekeepers')} value={bkAgg?.total} testId="stat-beekeepers" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8">
          <div className="flex" data-testid="dashboard-tabs">
            <button
              data-testid="dashboard-tab-supply"
              onClick={() => setTab('supply')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'supply'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.supplyChainOverview')}
            </button>
            <button
              data-testid="dashboard-tab-transactions"
              onClick={() => setTab('transactions')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'transactions'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.transactionOverview')}
            </button>
            <button
              data-testid="dashboard-tab-season"
              onClick={() => setTab('season')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'season'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.seasonTab')}
            </button>
            <button
              data-testid="dashboard-tab-indicators"
              onClick={() => setTab('indicators')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'indicators'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.indicatorsTab')}
            </button>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-[#cfd8e6] rounded-b-[5px] px-8 py-4 flex flex-col gap-2">
            <span className="text-[13px] text-[#5a6f9a]">
              {tab === 'transactions' ? t('dashboard.filterHintTransactions') : t('dashboard.filterHint')}
            </span>
            <div className="flex gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.country')}</span>
                <Select value={country || 'all'} onValueChange={(v) => setCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger data-testid="dashboard-filter-country" className="w-[180px] bg-white border-[#cfd8e6]">
                    <SelectValue placeholder={t('dashboard.allCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('dashboard.allCountry')}</SelectItem>
                    {(countries.length > 0
                      ? countries.map((c) => ({ key: c.name, value: c.name, label: c.name }))
                      : COUNTRIES.map((c) => ({ key: c, value: c, label: c }))
                    ).map((c) => (
                      <SelectItem key={c.key} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.actors')}</span>
                <Select value={actorFilter || 'all'} onValueChange={(v) => setActorFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger data-testid="dashboard-filter-actor-type" className="w-[180px] bg-white border-[#cfd8e6]">
                    <SelectValue placeholder={t('dashboard.allActors')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('dashboard.allActors')}</SelectItem>
                    {Object.keys(ACTOR_TYPE_COLORS).map((tName) => (
                      <SelectItem key={tName} value={tName}>{tName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.year')}</span>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger data-testid="dashboard-filter-year" className="w-[140px] bg-white border-[#cfd8e6]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="px-8 pt-6">
          {tab === 'supply' ? (
            <div className="flex flex-wrap gap-6" data-testid="dashboard-charts-supply">
              <ChartCard
                title={t("dashboard.actorTypeDistribution")}
                testId="chart-actor-types"
                isEmpty={actorTypeData.length === 0 || actorTypeData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={actorTypeData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {actorTypeData.map((entry) => (
                        <Cell key={entry.name} fill={ACTOR_TYPE_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title={t("dashboard.totalHivesInstalled")}
                testId="chart-hives"
                isEmpty={hiveData.length === 0 || hiveData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={hiveData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {hiveData.map((entry) => (
                        <Cell key={entry.name} fill={HIVE_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title={t("dashboard.beekeepersOverview")}
                testId="chart-gender"
                isEmpty={genderData.length === 0 || genderData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={genderData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {genderData.map((entry) => (
                        <Cell key={entry.name} fill={GENDER_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : tab === 'transactions' ? (
            <div className="flex flex-wrap gap-6" data-testid="dashboard-charts-transactions">
              <ChartCard title={t('dashboard.transactionOverview')} testId="chart-transactions-by-direction">
                {txSummary && txSummary.total > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={[
                        { name: t('nav.received'), value: txSummary.byDirection.Received },
                        { name: t('nav.processing'), value: txSummary.byDirection.Processing },
                        { name: t('nav.send'), value: txSummary.byDirection.Send },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0f48aa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[#5a6f9a] text-center py-16">{t('common.noRecordsFound')}</p>
                )}
              </ChartCard>

              <ChartCard title={t('contractWizard.products')} testId="chart-transactions-by-product">
                {txSummary && txSummary.byProduct.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={txSummary.byProduct} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 11, fill: '#5a6f9a' }} />
                      <Tooltip />
                      <Bar dataKey="quantity" fill="#2d9cdb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[#5a6f9a] text-center py-16">{t('common.noRecordsFound')}</p>
                )}
              </ChartCard>
            </div>
          ) : tab === 'season' ? (
            <div className="flex flex-col gap-6" data-testid="dashboard-season-page">
              {/* Builds the "Initial row" (7 Potential KPI cards) and
                  "Achieve row" (7 % gauges) specified in the Power BI
                  handoff document, using this app's own real, live
                  data. "Achieved" is defined explicitly in
                  useSeasonMetrics.js: an actor with at least one real
                  transaction in the selected year. The rest of the
                  source document's Season page (currency-converted
                  purchase totals, monthly/cumulative charts, Process &
                  Stocks) is a deliberately separate, later piece, not
                  part of this first build. */}
              <div className="flex flex-wrap gap-4" data-testid="season-potential-row">
                <StatCard label={t('dashboard.season.localPartners')} value={seasonMetrics?.potential.localPartners} testId="season-stat-local-partners" />
                <StatCard label={t('dashboard.season.countries')} value={seasonMetrics?.potential.countries} testId="season-stat-countries" />
                <StatCard label={t('dashboard.season.aggregators')} value={seasonMetrics?.potential.aggregators} testId="season-stat-aggregators" />
                <StatCard label={t('dashboard.season.producerOrganisations')} value={seasonMetrics?.potential.producerOrganisations} testId="season-stat-po" />
                <StatCard label={t('dashboard.season.villages')} value={seasonMetrics?.potential.villages} testId="season-stat-villages" />
                <StatCard label={t('dashboard.season.beekeepers')} value={seasonMetrics?.potential.beekeepers} testId="season-stat-beekeepers" />
                <StatCard label={t('dashboard.season.beehives')} value={seasonMetrics?.potential.beehives} testId="season-stat-beehives" />
              </div>
              {seasonMetrics && (
                <div className="flex flex-wrap gap-4" data-testid="season-achieved-row">
                  <GaugeCard label={t('dashboard.season.localPartners')} achieved={seasonMetrics.achieved.localPartners} potential={seasonMetrics.potential.localPartners} testId="season-gauge-local-partners" />
                  <GaugeCard label={t('dashboard.season.countries')} achieved={seasonMetrics.achieved.countries} potential={seasonMetrics.potential.countries} testId="season-gauge-countries" />
                  <GaugeCard label={t('dashboard.season.aggregators')} achieved={seasonMetrics.achieved.aggregators} potential={seasonMetrics.potential.aggregators} testId="season-gauge-aggregators" />
                  <GaugeCard label={t('dashboard.season.producerOrganisations')} achieved={seasonMetrics.achieved.producerOrganisations} potential={seasonMetrics.potential.producerOrganisations} testId="season-gauge-po" />
                  <GaugeCard label={t('dashboard.season.villages')} achieved={seasonMetrics.achieved.villages} potential={seasonMetrics.potential.villages} testId="season-gauge-villages" />
                  <GaugeCard label={t('dashboard.season.beekeepers')} achieved={seasonMetrics.achieved.beekeepers} potential={seasonMetrics.potential.beekeepers} testId="season-gauge-beekeepers" />
                  <GaugeCard label={t('dashboard.season.beehives')} achieved={seasonMetrics.achieved.beehives} potential={seasonMetrics.potential.beehives} testId="season-gauge-beehives" />
                </div>
              )}

              {/* Purchases/Receptions section, per the Power BI handoff
                  document's own table visual spec: TOTAL/Marron/Jaune
                  rows showing quantity received, contract quantity,
                  % of contract fulfilled, and year-over-year change on
                  a year-to-date basis. */}
              {seasonPurchases && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4" data-testid="season-purchases-table">
                  <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.season.purchasesTitle')}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                        <th className="py-2 font-medium">{t('dashboard.season.row')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.situationKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.contratKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.pctContrat')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.yoy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: t('dashboard.season.total'), qty: seasonPurchases.qtyTotal, contract: seasonPurchases.contractTotal, pct: seasonPurchases.pctTotal, yoy: seasonPurchases.yoyTotal, testId: 'total' },
                        { label: t('dashboard.season.cireMarron'), qty: seasonPurchases.qtyMarron, contract: seasonPurchases.contractMarron, pct: seasonPurchases.pctMarron, yoy: seasonPurchases.yoyMarron, testId: 'marron' },
                        { label: t('dashboard.season.cireJaune'), qty: seasonPurchases.qtyJaune, contract: seasonPurchases.contractJaune, pct: seasonPurchases.pctJaune, yoy: seasonPurchases.yoyJaune, testId: 'jaune' },
                      ].map((row) => (
                        <tr key={row.testId} className="border-b border-[#f5f5f5] last:border-0" data-testid={`season-purchases-row-${row.testId}`}>
                          <td className="py-2 font-medium text-[#032b71]">{row.label}</td>
                          <td className="py-2 text-right text-[#032b71]">{row.qty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{row.contract.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td className="py-2 text-right text-[#032b71] font-medium">{Math.round(row.pct * 100)}%</td>
                          <td className={`py-2 text-right font-medium ${row.yoy >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                            {row.yoy >= 0 ? '▲' : '▼'} {Math.abs(Math.round(row.yoy * 100))}pt
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {seasonPurchases && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-col gap-1 w-fit" data-testid="season-amount-card">
                  <span className="text-xs text-[#5a6f9a]">{t('dashboard.season.amountOfPurchase')}</span>
                  <span className="text-2xl font-black text-[#032b71]">{Math.round(seasonPurchases.amountXof).toLocaleString()} XOF</span>
                  {seasonPurchases.missingRateCurrencies.length > 0 && (
                    <p className="text-xs text-[#ba550c] mt-1" data-testid="season-missing-rates-warning">
                      {t('dashboard.season.missingRatesWarning', { currencies: seasonPurchases.missingRateCurrencies.join(', ') })}
                    </p>
                  )}
                </div>
              )}

              {/* Section 5.4: monthly combo chart. Column = this
                  year's % of the full-year contract received that
                  month; line = the same month last year. Month order
                  is real calendar order (Jan-Dec array), not
                  alphabetical -- the exact axis-order bug the source
                  document had to fix by hand. */}
              {seasonMonthly && (
                <ChartCard title={t('dashboard.season.monthlyChartTitle')} testId="season-monthly-chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={seasonMonthly.total} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                      <Legend />
                      <Bar dataKey="pctThisYear" name={t('dashboard.season.thisYear', { year })} fill="#0f48aa" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="pctPrevYear" name={t('dashboard.season.lastYear', { year: Number(year) - 1 })} stroke="#ba550c" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Section 5.5: cumulative version of the same chart --
                  a running total through each month, divided by the
                  full-year contract, rather than each month in
                  isolation. */}
              {seasonMonthly && (
                <ChartCard title={t('dashboard.season.cumulativeChartTitle')} testId="season-cumulative-chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={seasonMonthly.total} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                      <Legend />
                      <Bar dataKey="cumPctThisYear" name={t('dashboard.season.thisYear', { year })} fill="#0f48aa" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="cumPctPrevYear" name={t('dashboard.season.lastYear', { year: Number(year) - 1 })} stroke="#ba550c" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Section 5.6: Process, Stocks & Sales. Stock Raw
                  Material, Loss rate, and Stock Final are deliberately
                  cumulative all-time (ignore the Year filter, per the
                  source document's own confirmed business rule) --
                  only Sales below respects the selected Year. */}
              {seasonStocks && (
                <>
                  <div className="flex flex-wrap gap-4">
                    <StatCard label={t('dashboard.season.stockRawMaterial')} value={`${seasonStocks.stockRawMaterial.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} testId="season-stock-raw" />
                    <StatCard label={t('dashboard.season.stockFinal')} value={`${seasonStocks.stockFinal.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} testId="season-stock-final" />
                  </div>

                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4" data-testid="season-loss-rate-table">
                    <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.season.lossRateTitle')}</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                          <th className="py-2 font-medium">{t('dashboard.season.row')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.season.entree')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.season.sortie')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.season.tauxPerte')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: t('dashboard.season.total'), entree: seasonStocks.lossRate.entreeMarron + seasonStocks.lossRate.entreeJaune, sortie: seasonStocks.lossRate.sortieMarron + seasonStocks.lossRate.sortieJaune, taux: seasonStocks.lossRate.total, testId: 'total' },
                          { label: t('dashboard.season.cireMarron'), entree: seasonStocks.lossRate.entreeMarron, sortie: seasonStocks.lossRate.sortieMarron, taux: seasonStocks.lossRate.marron, testId: 'marron' },
                          { label: t('dashboard.season.cireJaune'), entree: seasonStocks.lossRate.entreeJaune, sortie: seasonStocks.lossRate.sortieJaune, taux: seasonStocks.lossRate.jaune, testId: 'jaune' },
                        ].map((row) => (
                          <tr key={row.testId} className="border-b border-[#f5f5f5] last:border-0" data-testid={`season-loss-rate-row-${row.testId}`}>
                            <td className="py-2 font-medium text-[#032b71]">{row.label}</td>
                            <td className="py-2 text-right text-[#032b71]">{row.entree.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            <td className="py-2 text-right text-[#5a6f9a]">{row.sortie.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            <td className={`py-2 text-right font-medium ${row.taux >= 0 ? 'text-[#ba550c]' : 'text-[#1e8e3e]'}`}>{Math.round(row.taux * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ChartCard title={t('dashboard.season.salesTitle')} testId="season-sales-donut" isEmpty={seasonStocks.sales.total === 0}>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('dashboard.season.cireMarron'), value: seasonStocks.sales.marron },
                            { name: t('dashboard.season.cireJaune'), value: seasonStocks.sales.jaune },
                          ]}
                          dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                        >
                          <Cell fill="#7a4a1e" />
                          <Cell fill="#e8b93a" />
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* "Livraison de cire par mois" -- deliberately left
                      out of the first pass for lack of a concrete
                      spec; a real screenshot of the source dashboard
                      confirmed its exact shape, so it's built here now.
                      Real months with zero deliveries render as real
                      zero bars, not skipped -- matching the source's
                      own chart, which shows every month even when 10
                      of them are empty. */}
                  <ChartCard title={t('dashboard.season.monthlyDeliveriesTitle')} testId="season-monthly-deliveries-chart">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={seasonStocks.monthlyDeliveries} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                        <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                        <Legend />
                        <Bar dataKey="marron" name={t('dashboard.season.cireMarron')} stackId="deliveries" fill="#7a4a1e" />
                        <Bar dataKey="jaune" name={t('dashboard.season.cireJaune')} stackId="deliveries" fill="#e8b93a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6" data-testid="dashboard-indicators-page">
              {/* Builds the Indicators page's 6.1 "Quantity & Quality"
                  section basics from the Power BI handoff document:
                  Standard split donut, Total Beeswax card, Yellow
                  Beeswax card (both with year-over-year), and the
                  country ratio table. The rest of 6.1 (Completion rate
                  donut, the 6-year trend chart, the Local Partners'
                  Performance table) and all of 6.2/6.3 are separate,
                  later pieces, not part of this batch. */}
              {indicatorsQuality && (
                <div className="flex flex-wrap gap-4" data-testid="indicators-cards-row">
                  <StatCard label={t('dashboard.indicators.totalBeeswax')} value={`${indicatorsQuality.totalBeeswax.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} testId="indicators-total-beeswax" />
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center" data-testid="indicators-total-beeswax-yoy">
                    <span className={`text-sm font-bold ${indicatorsQuality.totalBeeswaxYoy >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                      {indicatorsQuality.totalBeeswaxYoy >= 0 ? '▲' : '▼'} {Math.abs(Math.round(indicatorsQuality.totalBeeswaxYoy * 100))}%
                    </span>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.indicators.vsLastYear')}</span>
                  </div>
                  <StatCard label={t('dashboard.indicators.yellowBeeswax')} value={`${indicatorsQuality.totalYellow.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg (${Math.round(indicatorsQuality.yellowRatio * 100)}%)`} testId="indicators-yellow-beeswax" />
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center" data-testid="indicators-yellow-beeswax-yoy">
                    <span className={`text-sm font-bold ${indicatorsQuality.yellowYoy >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                      {indicatorsQuality.yellowYoy >= 0 ? '▲' : '▼'} {Math.abs(Math.round(indicatorsQuality.yellowYoy * 100))}%
                    </span>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.indicators.vsLastYear')}</span>
                  </div>
                </div>
              )}

              {indicatorsQuality && Object.keys(indicatorsQuality.byStandard).length > 0 && (
                <ChartCard title={t('dashboard.indicators.standardSplitTitle')} testId="indicators-standard-donut">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={Object.entries(indicatorsQuality.byStandard).map(([name, value]) => ({ name, value }))}
                        dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                      >
                        {Object.keys(indicatorsQuality.byStandard).map((name) => (
                          <Cell key={name} fill={{ Sustainable: '#1e8e3e', Organic: '#0f48aa', Conventional: '#ba550c' }[name] || '#cfd8e6'} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {indicatorsQuality && indicatorsQuality.countryTable.length > 0 && (
                <div className="flex flex-wrap gap-4 items-stretch">
                  {/* Real gap closed, confirmed via a real screenshot
                      of the source dashboard: this pie chart (total
                      quantity share by country) was previously left
                      out for lack of a concrete spec -- the text
                      handoff document's own words said it "wasn't
                      fully specified in conversation." */}
                  <ChartCard title={t('dashboard.indicators.countryPieTitle')} testId="indicators-country-pie">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={indicatorsQuality.countryTable.map((row) => ({ name: row.country, value: row.total }))}
                          dataKey="value" nameKey="name" innerRadius={0} outerRadius={90} isAnimationActive={false}
                          label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                        >
                          {indicatorsQuality.countryTable.map((row, i) => (
                            <Cell key={row.country} fill={['#0f48aa', '#ba550c', '#1e8e3e', '#7a4a1e', '#e8b93a', '#5a6f9a', '#032b71'][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex-1 min-w-[300px]" data-testid="indicators-country-table">
                    <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.indicators.countryTableTitle')}</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                          <th className="py-2 font-medium">{t('dashboard.indicators.country')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowKg')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowRatio')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicatorsQuality.countryTable.map((row) => (
                          <tr key={row.country} className="border-b border-[#f5f5f5] last:border-0" data-testid={`indicators-country-row-${row.country}`}>
                            <td className="py-2 font-medium text-[#032b71]">{row.country}</td>
                            <td className="py-2 text-right text-[#5a6f9a]">{row.yellow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 text-right text-[#032b71] font-medium">{Math.round(row.ratio * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Completion Rate donut. Real, documented bug in the
                  source project's own first attempt at this, avoided
                  here from the start: building the two donut slices
                  from raw Qty/Contract values directly gives a
                  meaningless ~49/51 split, since a donut normalizes
                  its own slice values to sum to 100% of themselves --
                  not the same as a true "% of contract" reading. Uses
                  Completion Rate / Completion Rate Remaining instead,
                  which correctly sum to exactly 100%. Reuses
                  seasonPurchases.pctTotal (already fetched on this
                  page) rather than a new query, since "Completion
                  Rate" and that value are the same calculation.
                  Deliberately does not include the source's own
                  per-Local-Partner slicer -- its own document flags
                  that as never confirmed working even in the original
                  project. */}
              {seasonPurchases && (
                <div className="flex flex-wrap gap-4 items-stretch">
                  <StatCard label={t('dashboard.indicators.contractTotal')} value={`${seasonPurchases.contractTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} testId="indicators-contract-card" />
                  <ChartCard title={t('dashboard.indicators.completionRateTitle')} testId="indicators-completion-donut">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('dashboard.indicators.achieved'), value: Math.min(seasonPurchases.pctTotal, 1) },
                            { name: t('dashboard.indicators.remaining'), value: Math.max(1 - seasonPurchases.pctTotal, 0) },
                          ]}
                          dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                        >
                          <Cell fill="#0f48aa" />
                          <Cell fill="#e8ecf3" />
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-center text-2xl font-black text-[#032b71] -mt-4">{Math.round(seasonPurchases.pctTotal * 100)}%</p>
                  </ChartCard>
                </div>
              )}

              {/* Yearly Quantité/Contrat/Qualité trend, last 6 real
                  years with data -- deliberately independent of this
                  page's own Year filter, per the source document's own
                  "Edit interactions -> None" setup for this specific
                  chart. "Contrat" is a hollow, outlined bar rendered
                  behind "Quantité" (a solid bar), using a negative
                  barGap to force full overlap rather than the usual
                  side-by-side clustering -- so when the two values are
                  close, it reads as one bar with a visible target
                  line, matching the "bar-in-bar" effect the source
                  needed a much more involved two-layered-visual
                  workaround to achieve in Power BI. */}
              {indicatorsYearly && indicatorsYearly.length > 0 && (
                <ChartCard title={t('dashboard.indicators.yearlyTrendTitle')} testId="indicators-yearly-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={indicatorsYearly} barGap="-100%" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis yAxisId="kg" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip formatter={(v, name) => (name === t('dashboard.indicators.qualite') ? `${Math.round(v * 100)}%` : `${Number(v).toLocaleString()} kg`)} />
                      <Legend />
                      <Bar yAxisId="kg" dataKey="contract" name={t('dashboard.indicators.contrat')} fill="transparent" stroke="#032b71" strokeWidth={1.5} />
                      <Bar yAxisId="kg" dataKey="qty" name={t('dashboard.indicators.quantite')} fill="#0f48aa" />
                      <Line yAxisId="pct" type="monotone" dataKey="qualite" name={t('dashboard.indicators.qualite')} stroke="#ba550c" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Local Partners' Performance table (Top 20). Real
                  business rules matched exactly from the source
                  document: ranked/filtered to Top 20 by CONTRACT
                  quantity (not delivered); Evolution (rank change) is
                  based on DELIVERED quantity instead, explicitly
                  different from the ranking basis; % Cire Jaune is
                  each actor's own ratio, not a company-wide share.
                  Flags use this app's own real, confirmed country
                  spellings, not the source's own unverified list. */}
              {indicatorsLocalPartners && indicatorsLocalPartners.length > 0 && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 overflow-x-auto" data-testid="indicators-local-partners-table">
                  <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.indicators.localPartnersTitle')}</h3>
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                        <th className="py-2 font-medium"></th>
                        <th className="py-2 font-medium">{t('dashboard.indicators.actorName')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.evolution')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.contratKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.deliveredKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.pctAppro')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.pctContrat')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowRatio')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorsLocalPartners.map((row) => (
                        <tr key={row.actorId} className="border-b border-[#f5f5f5] last:border-0" data-testid={`indicators-lp-row-${row.actorId}`}>
                          <td className="py-2">
                            <img src={row.flagUrl} alt={row.country || ''} className="h-4 w-6 object-cover rounded-sm" />
                          </td>
                          <td className="py-2 font-medium text-[#032b71]">{row.name}</td>
                          <td className={`py-2 text-right font-medium ${row.evolution > 0 ? 'text-[#1e8e3e]' : row.evolution < 0 ? 'text-[#ba550c]' : 'text-[#5a6f9a]'}`}>
                            {row.evolution > 0 ? '▲' : row.evolution < 0 ? '▼' : '–'} {row.evolution !== 0 ? Math.abs(row.evolution) : ''}
                          </td>
                          <td className="py-2 text-right text-[#5a6f9a]">{row.contract.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#032b71]">{row.qty.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{Math.round(row.pctAppro * 100)}%</td>
                          <td className="py-2 text-right text-[#032b71] font-medium">{Math.round(row.pctContrat * 100)}%</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{row.qtyYellow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{Math.round(row.pctYellow * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
