// Compatibility shim. The implementation now lives in the transactions feature
// module (src/features/transactions); this file keeps the original import path
// working for existing consumers so the refactor changes zero call sites.
export {
  useLossRecords, useTransactions, useTransactionLoggers, useActorTransactions,
  useBeekeeperTransactions, summarizeTransactions, useDashboardTransactionSummary,
  useTransaction, useLinkedTransactionStatus, useProductsWithStock,
  useAvailableBatches, useProcessStock, useConsumeStockBatch, useRecordBatchSelection,
  useApproveTransaction, useRejectTransaction, useTransactionBatchSelections,
  useCreateTransaction, useAttachTransactionFile,
} from '@/features/transactions';
