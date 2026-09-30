// Extracted verbatim from Dashboard.jsx's own inline ternary branch during
// its component-decomposition refactor (see StatCard.jsx for why). The JSX
// body below is an EXACT copy of the original -- every prop this component
// takes is a value the original file already had in scope at that point;
// nothing was recomputed or renamed.

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import ChartCard from '../ChartCard';
import StatCard from '../StatCard';
import GaugeCard from '@/components/common/GaugeCard';

export default function SeasonTab({ seasonMetrics, seasonPurchases, seasonMonthly, seasonStocks, countries, year }) {
  const { t } = useTranslation();
  return (
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
  );
}
