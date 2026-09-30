// Extracted verbatim from Dashboard.jsx's own inline ternary branch during
// its component-decomposition refactor (see StatCard.jsx for why). The JSX
// body below is an EXACT copy of the original -- every prop this component
// takes is a value the original file already had in scope at that point;
// nothing was recomputed or renamed.

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import ChartCard from '../ChartCard';

export default function TransactionsTab({ txSummary }) {
  const { t } = useTranslation();
  return (
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
  );
}
