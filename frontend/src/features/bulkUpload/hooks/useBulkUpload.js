import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { BULK_UPLOAD_TEMPLATES } from '../domain/templates';
import { detectUnrecognizedColumns } from '../domain/headers';
import { validateRows } from '../domain/validateRows';
import { summarizeRowErrors, formatErrorDetail } from '../domain/rowErrors';
import { parseFile } from '../infrastructure/excelReader';
import { fetchLookups } from '../infrastructure/lookups';
import { recordBulkUpload } from '../infrastructure/uploadHistory';
import { resolveNewVillages } from '../application/resolveNewVillages';
import { importHistoricalTransactions } from '../application/importHistoricalTransactions';
import { importRows } from '../application/importRows';

// Presentation-layer orchestration only: owns React state, the double-submit guard,
// and query-cache invalidation. Everything that touches the database or the file
// lives in the layers below (application / infrastructure) behind an injected client.
export function useBulkUpload(templateKey) {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [result, setResult] = useState(null);
  const [isHistorical, setIsHistorical] = useState(false);
  const [unrecognizedColumns, setUnrecognizedColumns] = useState([]);
  // disabled={uploading} alone has a known race (React's re-render isn't synchronous),
  // and this hook is shared by 3 different callers, so guarding once here protects
  // all of them consistently.
  const submittingRef = useRef(false);

  const loadFile = useCallback(async (file) => {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    setUnrecognizedColumns([]);
    setParsing(true);
    try {
      const [rawRows, lookups] = await Promise.all([
        parseFile(file, template),
        fetchLookups(supplyChainId, templateKey),
      ]);
      setUnrecognizedColumns(detectUnrecognizedColumns(rawRows, template));
      const validated = validateRows(rawRows, template, lookups, isHistorical);
      setRows(validated);

      // When every row fails validation the Import button is disabled, so submit() --
      // and the history logging inside it -- never runs, and a fully failed attempt
      // (the case someone most needs a record of) would vanish the moment they closed
      // the dialog. Logged here instead. Contracts excluded: bulk_uploads.upload_type
      // has a CHECK constraint that doesn't include 'Contracts'.
      const validCountNow = validated.filter((r) => r.errors.length === 0).length;
      if (validCountNow === 0 && validated.length > 0 && template.table !== 'contracts' && supplyChainId) {
        const logged = await recordBulkUpload(supabase, {
          supplyChainId,
          uploadType: template.uploadType,
          fileName: file.name,
          status: 'Failed',
          errorDetail: formatErrorDetail(summarizeRowErrors(validated)),
        });
        if (logged) queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
      }
      return validated;
    } catch (err) {
      // parseFile rejects (e.g. non-.xlsx file) with a real Error. Stored for callers
      // that just read `parseError` (ReceiveStockForm's fire-and-forget onChange), and
      // re-thrown for callers that already await + catch (AddBeekeeperDialog).
      setRows([]);
      setParseError(err.message);
      throw err;
    } finally {
      setParsing(false);
    }
  }, [template, templateKey, supplyChainId, isHistorical, queryClient]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const submit = useCallback(async (options = {}) => {
    if (submittingRef.current) return { inserted: 0, failed: 0 };
    submittingRef.current = true;
    setUploading(true);
    // Cleared on EVERY exit path (success, early return, partial failure, throw).
    // It was once switched on and never off, so only the first upload in a session
    // ever reached the database.
    try {
      // Callers that call `await loadFile(file)` then immediately `await submit(...)`
      // in one handler (AddBeekeeperDialog) hold a `submit` whose closure predates
      // loadFile's setRows -- so they pass the freshly validated rows explicitly as
      // options.rows (like options.fileName) instead of relying on stale state.
      const effectiveRows = options.rows ?? rows;
      const validRows = effectiveRows.filter((r) => r.errors.length === 0).map((r) => ({
        ...r.data,
        supply_chain_id: supplyChainId,
        // receiveStock rows carry no standard/unit column, so they're stamped from the
        // batch-level choice. direction likewise: the template has no direction column
        // (it's implicitly always 'Received'), but the transactions_insert RLS policy's
        // with_check needs a real value -- with it missing, both `direction = 'Send'`
        // and `direction <> 'Send'` evaluate to NULL and every row was rejected.
        ...(templateKey === 'receiveStock' ? { standard: options.standard, unit: 'Kg', direction: 'Received' } : {}),
      }));

      if (templateKey === 'beekeepers') {
        await resolveNewVillages(supabase, validRows, supplyChainId);
        queryClient.invalidateQueries({ queryKey: ['villages'] });
        queryClient.invalidateQueries({ queryKey: ['villages-lite'] });
      }

      const validationFailedCount = effectiveRows.length - validRows.length;
      const validationErrorMessages = summarizeRowErrors(effectiveRows);
      // options.fileName is the real File object's own name, sidestepping the stale
      // closure over `fileName` state.
      const uploadFileName = options.fileName ?? fileName;

      if (template.table === 'transactions' && isHistorical) {
        const { inserted, failed, shortfallCount, errors } = await importHistoricalTransactions(
          supabase, validRows, { templateKey, options, validationErrorMessages }
        );
        const totalFailed = failed + validationFailedCount;
        await recordBulkUpload(supabase, {
          supplyChainId,
          uploadType: template.uploadType,
          fileName: uploadFileName,
          status: inserted === 0 ? 'Failed' : 'Completed',
          errorDetail: formatErrorDetail(errors),
        });
        if (inserted > 0) {
          queryClient.invalidateQueries({ queryKey: [template.table] });
          queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
          queryClient.invalidateQueries({ queryKey: ['stocks'] });
        }
        setUploading(false);
        const res = { inserted, updated: 0, failed: totalFailed, errors, shortfallCount };
        setResult(res);
        return res;
      }

      const { inserted, updated, failed, errors } = await importRows(supabase, {
        template, validRows, supplyChainId, validationErrorMessages,
      });
      const totalFailed = failed + validationFailedCount;

      // Log so the Bulk Uploads history page reflects real activity. Contracts are
      // skipped on purpose: bulk_uploads.upload_type's CHECK constraint doesn't include
      // 'Contracts' and the product owner chose not to widen it.
      if (template.table !== 'contracts') {
        await recordBulkUpload(supabase, {
          supplyChainId,
          uploadType: template.uploadType,
          fileName: uploadFileName,
          status: (inserted === 0 && updated === 0) ? 'Failed' : 'Completed',
          errorDetail: formatErrorDetail(errors),
          ...(template.uploadType === 'Connections'
            ? { extra: { new_beekeepers: inserted, updated_beekeepers: updated } }
            : {}),
        });
      }

      if (inserted > 0 || updated > 0) {
        queryClient.invalidateQueries({ queryKey: [template.table] });
        queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
      }

      setUploading(false);
      setResult({ inserted, updated, failed: totalFailed, errors });
      return { inserted, updated, failed: totalFailed, errors };
    } finally {
      submittingRef.current = false;
      setUploading(false);
    }
  }, [rows, supplyChainId, template, fileName, queryClient, isHistorical, templateKey]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
    setParseError(null);
    setParsing(false);
    setUnrecognizedColumns([]);
  }, []);

  return {
    template,
    rows,
    fileName,
    validCount,
    errorCount,
    uploading,
    parsing,
    parseError,
    result,
    isHistorical,
    setIsHistorical,
    unrecognizedColumns,
    loadFile,
    submit,
    reset,
  };
}
