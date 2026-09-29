// Public API of the transactions feature. Consumers import from here (or from the
// legacy '@/hooks/useTransactions' shim) -- never reach into hooks/lists.js etc.
// directly, so these files can keep being reorganised without touching a page.
export {
  useLossRecords, useTransactions, useTransactionLoggers,
  useActorTransactions, useBeekeeperTransactions, useDashboardTransactionSummary,
} from './hooks/lists';
export { useTransaction, useLinkedTransactionStatus, useTransactionBatchSelections } from './hooks/detail';
export {
  useProductsWithStock, useAvailableBatches,
  useProcessStock, useConsumeStockBatch, useRecordBatchSelection,
} from './hooks/stock';
export { useApproveTransaction, useRejectTransaction } from './hooks/workflow';
export { useCreateTransaction } from './hooks/create';
export { summarizeTransactions } from './domain/summarizeTransactions';
