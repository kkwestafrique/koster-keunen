import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { STANDARDS, COMMITMENT_OF_BEEKEEPER, PRODUCTS } from '@/data/regions';

// Column definitions per target table. "required" fields must be present and non-empty on every row.
export const BULK_UPLOAD_TEMPLATES = {
  beekeepers: {
    label: 'Beekeepers',
    table: 'beekeepers',
    uploadType: 'Connections', // matches bulk_uploads.upload_type CHECK constraint
    columns: [
      { key: 'full_name', label: 'Full name', required: true },
      { key: 'gender', label: 'Gender', required: true, allowed: ['Male', 'Female', 'Other'] },
      { key: 'village_name', label: 'Village', required: true },
      { key: 'national_id', label: 'National ID', required: false },
      { key: 'internal_code', label: 'Internal code', required: false },
      { key: 'year_of_birth', label: 'Year of birth', required: false, type: 'number' },
      { key: 'linked_producer_organisation', label: 'Linked producer organisation', required: false },
      { key: 'contact_email', label: 'Contact email', required: false },
      { key: 'contact_phone', label: 'Contact number', required: false },
      { key: 'standards', label: 'Standards (comma-separated: Sustainable, Organic, Conventional)', required: false, type: 'array', allowed: STANDARDS },
      { key: 'charter_signed', label: 'Sustainable Beekeeper charter approved (Yes/No)', required: false, type: 'boolean' },
      { key: 'commitment', label: 'Commitment of beekeeper (comma-separated: Crude honey, Honey, Beeswax)', required: false, type: 'array', allowed: COMMITMENT_OF_BEEKEEPER },
      { key: 'hives_traditional_single', label: 'Traditional single entry hives', required: false, type: 'number' },
      { key: 'hives_traditional_double', label: 'Traditional double entries hives', required: false, type: 'number' },
      { key: 'hives_modern', label: 'Modern hives', required: false, type: 'number' },
      { key: 'hives_other', label: 'Other hives', required: false, type: 'number' },
      { key: 'hive_cashew', label: 'Cashew', required: false, type: 'number' },
      { key: 'hive_mango', label: 'Mango', required: false, type: 'number' },
      { key: 'hive_shea', label: 'Shea', required: false, type: 'number' },
      { key: 'hive_forest', label: 'Forest', required: false, type: 'number' },
      { key: 'hive_other_forage', label: 'Other forage', required: false, type: 'number' },
      { key: 'active_years', label: 'Active years', required: false, type: 'number' },
    ],
  },
  transactions: {
    label: 'Transactions',
    table: 'transactions',
    uploadType: 'Transactions',
    columns: [
      { key: 'transaction_date', label: 'Date', required: true },
      { key: 'actor_code', label: 'Actor traceability code', required: false },
      { key: 'beekeeper_code', label: 'Beekeeper traceability code', required: false },
      { key: 'product', label: 'Product', required: true },
      { key: 'standard', label: 'Standard', required: true, allowed: ['Sustainable', 'Organic', 'Conventional'] },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', required: false },
      { key: 'price', label: 'Price', required: true, type: 'number' },
      { key: 'direction', label: 'Direction', required: true, allowed: ['Received', 'Processing', 'Send'] },
    ],
  },
  contracts: {
    label: 'Contracts',
    table: 'contracts',
    uploadType: 'Contracts',
    columns: [
      { key: 'signature_date', label: 'Signature date', required: true },
      { key: 'actor_code', label: 'Supplier actor traceability code', required: true },
      { key: 'standard', label: 'Standard', required: true, allowed: ['Sustainable', 'Organic', 'Conventional'] },
      { key: 'product', label: 'Product', required: true, allowed: PRODUCTS },
      { key: 'expected_quantity', label: 'Expected quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', required: false },
      { key: 'price', label: 'Maximum price', required: true, type: 'number' },
      { key: 'currency', label: 'Currency', required: true },
      { key: 'advance_amount_paid', label: 'Advance amount paid', required: false, type: 'number' },
      { key: 'comments', label: 'Comments', required: false },
    ],
  },
};

// Generates and downloads an .xlsx template for the given template key —
// header row matches template.columns labels, with one example row to show
// the expected format. Used by the "Download excel template" buttons inside
// the Multiple-transaction flows (Received / Send).
export function downloadTemplate(templateKey, filename) {
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown bulk upload template: ${templateKey}`);

  const headers = template.columns.map((c) => c.label);
  const exampleRow = template.columns.map((c) => {
    if (c.type === 'array' && c.allowed) return c.allowed[0];
    if (c.type === 'boolean') return 'No';
    if (c.allowed) return c.allowed[0];
    if (c.type === 'number') return 0;
    if (c.key === 'transaction_date') return '2026-01-15';
    return '';
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, template.label);
  XLSX.writeFile(workbook, filename || `${template.label.toLowerCase()}-template.xlsx`);
}

function parseFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    } else {
      reject(new Error('Unsupported file type. Please upload an .xlsx file.'));
    }
  });
}

// Resolves the human-readable codes people actually type into a CSV/Excel
// sheet (village name, actor/beekeeper traceability code) into the real
// UUID foreign keys the tables need. Without this, bulk rows were being
// inserted with columns like village_name/actor_code/beekeeper_code, which
// don't exist on beekeepers/transactions at all — Supabase rejects the
// whole batch before anything is written.
async function fetchLookups(supplyChainId, templateKey) {
  const lookups = { villagesByName: {}, actorsByCode: {}, beekeepersByCode: {} };

  if (templateKey === 'beekeepers') {
    const { data, error } = await supabase.from('villages').select('id, name').eq('supply_chain_id', supplyChainId);
    if (error) throw error;
    data.forEach((v) => { lookups.villagesByName[v.name.trim().toLowerCase()] = v.id; });
  }

  if (templateKey === 'transactions' || templateKey === 'contracts') {
    const [actorsRes, beekeepersRes] = await Promise.all([
      supabase.from('actors').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
      supabase.from('beekeepers').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
    ]);
    if (actorsRes.error) throw actorsRes.error;
    if (beekeepersRes.error) throw beekeepersRes.error;
    actorsRes.data.forEach((a) => { if (a.traceability_code) lookups.actorsByCode[a.traceability_code.trim().toLowerCase()] = a.id; });
    beekeepersRes.data.forEach((b) => { if (b.traceability_code) lookups.beekeepersByCode[b.traceability_code.trim().toLowerCase()] = b.id; });
  }

  return lookups;
}

function validateRows(rows, template, lookups, isHistorical) {
  return rows.map((row, index) => {
    const errors = [];
    const cleaned = {};

    template.columns.forEach((col) => {
      let value = row[col.label] ?? row[col.key] ?? '';
      if (typeof value === 'string') value = value.trim();

      if (col.required && (value === '' || value === undefined || value === null)) {
        errors.push(`${col.label} is required`);
      }

      if (col.type === 'array') {
        const items = value === '' ? [] : String(value).split(',').map((s) => s.trim()).filter(Boolean);
        if (col.allowed) {
          const bad = items.filter((i) => !col.allowed.includes(i));
          if (bad.length) errors.push(`${col.label}: "${bad.join(', ')}" must be one of: ${col.allowed.join(', ')}`);
        }
        cleaned[col.key] = items;
        return;
      }

      if (col.type === 'boolean') {
        const normalized = String(value).trim().toLowerCase();
        cleaned[col.key] = ['yes', 'true', '1'].includes(normalized);
        return;
      }

      if (col.allowed && value && !col.allowed.includes(value)) {
        errors.push(`${col.label} must be one of: ${col.allowed.join(', ')}`);
      }
      if (col.type === 'number' && value !== '' && isNaN(Number(value))) {
        errors.push(`${col.label} must be a number`);
      }

      const numericValue = col.type === 'number' && value !== '' ? Number(value) : value;

      // Resolve text codes/names to the real FK columns instead of storing
      // them verbatim under a column name the table doesn't have.
      if (col.key === 'village_name') {
        if (value) {
          const id = lookups.villagesByName[String(value).toLowerCase()];
          if (!id) errors.push(`Village "${value}" not found`);
          cleaned.village_id = id || null;
        }
      } else if (col.key === 'actor_code') {
        if (value) {
          const id = lookups.actorsByCode[String(value).toLowerCase()];
          if (!id) errors.push(`Actor code "${value}" not found`);
          cleaned.actor_id = id || null;
        }
      } else if (col.key === 'beekeeper_code') {
        if (value) {
          const id = lookups.beekeepersByCode[String(value).toLowerCase()];
          if (!id) errors.push(`Beekeeper code "${value}" not found`);
          cleaned.beekeeper_id = id || null;
        }
      } else {
        cleaned[col.key] = numericValue;
      }
    });

    // Received transactions need a resolved beekeeper; Send needs a
    // resolved actor — cross-check now that direction is known.
    if (template.table === 'transactions') {
      if (cleaned.direction === 'Received' && !cleaned.beekeeper_id) {
        errors.push('Beekeeper traceability code is required for Received transactions');
      }
      if (cleaned.direction === 'Send' && !cleaned.actor_id) {
        errors.push('Actor traceability code is required for Send transactions');
      }
      // total_amount is never trusted from the file itself (a formula
      // cell, or a value someone typed by hand, could easily be wrong or
      // stale) — always recomputed here from the row's own quantity and
      // price, matching the spec's explicit requirement to never treat
      // Excel formulas as the source of truth.
      if (typeof cleaned.quantity === 'number' && typeof cleaned.price === 'number') {
        cleaned.total_amount = cleaned.quantity * cleaned.price;
      }
      // Historical import re-uses this same template/column shape (per
      // product owner's call) but only Received and Send map cleanly onto
      // it -- Processing needs a separate source vs. destination product,
      // which this flat template has no columns for. Rather than silently
      // mis-handling those rows, reject them clearly.
      if (isHistorical && cleaned.direction === 'Processing') {
        errors.push('Historical import does not support Processing rows yet — only Received and Send');
      }
      // Same explicit status as the single-transaction forms: Send is
      // auto-Approved at creation, Received (and Processing, which has no
      // status badge either way) start Pending so the Approve/Reject
      // workflow on the detail page actually has something to act on —
      // never rely on the table's own default here (confirmed bug:
      // defaults to 'Approved' for everything, which silently skips the
      // whole approval step for bulk-uploaded Received rows too). Historical
      // rows are an explicit exception: they're already-completed past
      // records, so they land Approved immediately, same as Send.
      cleaned.status = (cleaned.direction === 'Send' || isHistorical) ? 'Approved' : 'Pending';
    }

    // Historical Contracts import: one row = one contract (one product,
    // its own contract_group_id) — matches the single-Contract-per-product
    // shape useCreateContract() already produces, just skipping the
    // interactive wizard. contract_code/owning_actor_id are both set by
    // existing triggers on insert, same as the normal creation path.
    if (template.table === 'contracts') {
      if (!cleaned.actor_id) errors.push('Supplier actor traceability code is required');
      const parsedDate = cleaned.signature_date ? new Date(cleaned.signature_date) : null;
      cleaned.year = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : new Date().getFullYear();
      cleaned.contract_type = 'Send';
      cleaned.advance_amount_paid = cleaned.advance_amount_paid || 0;
      if (typeof cleaned.expected_quantity === 'number' && typeof cleaned.price === 'number') {
        cleaned.total_amount = cleaned.expected_quantity * cleaned.price;
        cleaned.advance_percent = cleaned.total_amount > 0
          ? Math.round((cleaned.advance_amount_paid / cleaned.total_amount) * 100)
          : 0;
      }
      cleaned.contract_group_id = crypto.randomUUID();
    }

    return { rowNumber: index + 2, data: cleaned, errors };
  });
}

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

  const loadFile = useCallback(async (file) => {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    setParsing(true);
    try {
      const [rawRows, lookups] = await Promise.all([
        parseFile(file),
        fetchLookups(supplyChainId, templateKey),
      ]);
      setRows(validateRows(rawRows, template, lookups, isHistorical));
    } catch (err) {
      // parseFile rejects (e.g. non-.xlsx file) with a real Error. Store it
      // for callers that just read `parseError` state (ReceiveStockForm's
      // fire-and-forget onChange), but also re-throw so callers that
      // already `await` + catch this themselves (AddBeekeeperDialog) keep
      // their existing, more specific error handling.
      setRows([]);
      setParseError(err.message);
      throw err;
    } finally {
      setParsing(false);
    }
  }, [template, templateKey, supplyChainId, isHistorical]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const submit = useCallback(async (options = {}) => {
    setUploading(true);
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => ({
      ...r.data,
      supply_chain_id: supplyChainId,
    }));
    const validationFailedCount = rows.length - validRows.length;

    // Historical transactions need `app.bulk_import_mode` set and (for
    // Send rows) auto_consume_stock_for_bulk_import() called in the SAME
    // db transaction as the insert -- neither is possible through a plain
    // client-side .insert(), so this path calls the bulk_import_transaction
    // RPC once per row instead of the generic batched insert below.
    if (template.table === 'transactions' && isHistorical) {
      let inserted = 0;
      let failed = 0;
      let shortfallCount = 0;
      const errors = [];
      for (const row of validRows) {
        const { data, error } = await supabase.rpc('bulk_import_transaction', {
          p_direction: row.direction,
          p_standard: row.standard,
          p_actor_id: row.actor_id || null,
          p_beekeeper_id: row.beekeeper_id || null,
          p_product: row.product,
          p_quantity: row.quantity,
          p_unit: row.unit || 'Kg',
          p_price: row.price,
          // The Transactions template has no currency column at all (it's
          // a supply-chain-wide currency choice made once on the form, not
          // per-row) -- `row.currency` is always undefined here, which
          // supabase-js strips entirely, breaking the RPC's arg match.
          // Callers must pass the form's selected currency explicitly.
          p_currency: options.currency,
          p_transaction_date: row.transaction_date,
        });
        if (error) {
          failed += 1;
          errors.push(error.message);
        } else {
          inserted += 1;
          if (data?.stock_shortfall > 0) shortfallCount += 1;
        }
      }
      const totalFailed = failed + validationFailedCount;
      try {
        await supabase.from('bulk_uploads').insert({
          supply_chain_id: supplyChainId,
          upload_type: template.uploadType,
          file_name: fileName,
          status: inserted === 0 ? 'Failed' : 'Completed',
          progress: 100,
          // Real bug found via independent audit (BUG-21): `errors` was
          // already being collected above, just never saved anywhere.
          error_detail: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
        });
      } catch (logErr) {
        console.error('Failed to log bulk upload history:', logErr);
      }
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

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    // For beekeepers specifically: re-uploading the same file (accidentally,
    // or "just to be safe") previously created genuine duplicate records --
    // the same class of real, documented problem found on the platform this
    // rebuild is measured against (real duplicate beekeepers, risk of
    // double-counting or double-payment). There's no traceability_code
    // column in this template (it's server-generated), so a database-level
    // upsert isn't directly possible -- instead, match existing beekeepers
    // by (full_name, village_id) within the same supply chain before
    // inserting, and update the existing row instead of creating a new one.
    // This deliberately does NOT attempt fuzzy/similarity matching across
    // near-duplicate spellings (e.g. "N Tcha Matie" vs "NTctha Matie") --
    // that's a separate, larger feature (a real merge-screen UI), not a
    // quick fix bolted onto this one.
    let existingByKey = new Map();
    if (template.table === 'beekeepers' && validRows.length > 0) {
      const { data: existing, error: lookupError } = await supabase
        .from('beekeepers')
        .select('id, full_name, village_id')
        .eq('supply_chain_id', supplyChainId);
      if (!lookupError && existing) {
        existingByKey = new Map(
          existing.map((b) => [`${b.full_name?.trim().toLowerCase()}|${b.village_id}`, b.id])
        );
      }
    }

    const toInsert = [];
    const toUpdate = [];
    if (existingByKey.size > 0) {
      for (const row of validRows) {
        const key = `${row.full_name?.trim().toLowerCase()}|${row.village_id}`;
        const existingId = existingByKey.get(key);
        if (existingId) {
          toUpdate.push({ id: existingId, ...row });
        } else {
          toInsert.push(row);
        }
      }
    } else {
      toInsert.push(...validRows);
    }

    // Insert in batches of 100 to avoid oversized payloads
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase.from(template.table).insert(batch).select('*', { count: 'exact' });
      if (error) {
        failed += batch.length;
        errors.push(error.message);
      } else {
        inserted += count ?? batch.length;
      }
    }

    // Updates go one at a time (each has a different id, so they can't be
    // batched into a single statement the way same-shape inserts can).
    for (const row of toUpdate) {
      const { id, ...patch } = row;
      const { error } = await supabase.from(template.table).update(patch).eq('id', id);
      if (error) {
        failed += 1;
        errors.push(error.message);
      } else {
        updated += 1;
      }
    }

    const totalFailed = failed + validationFailedCount;

    // Log this upload to bulk_uploads so the Bulk Uploads history page
    // (Connections/Transactions tabs) actually reflects real activity,
    // instead of always showing empty. Contracts imports are skipped here
    // on purpose: `bulk_uploads.upload_type` has a CHECK constraint that
    // doesn't include 'Contracts', and the product owner chose not to
    // widen it — the contracts themselves still import correctly, they
    // just won't show up on the Bulk Uploads history page.
    if (template.table !== 'contracts') {
      try {
        await supabase.from('bulk_uploads').insert({
          supply_chain_id: supplyChainId,
          upload_type: template.uploadType,
          file_name: fileName,
          status: (inserted === 0 && updated === 0) ? 'Failed' : 'Completed',
          progress: 100,
          // Same fix as the transactions path above (BUG-21): `errors`
          // was already being collected throughout this function, just
          // never saved anywhere.
          error_detail: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
          ...(template.uploadType === 'Connections'
            ? { new_beekeepers: inserted, updated_beekeepers: updated }
            : {}),
        });
      } catch (logErr) {
        // Don't let a logging failure block the person from seeing their
        // actual import result — just note it happened.
        console.error('Failed to log bulk upload history:', logErr);
      }
    }

    if (inserted > 0 || updated > 0) {
      queryClient.invalidateQueries({ queryKey: [template.table] });
      queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
    }

    setUploading(false);
    setResult({ inserted, updated, failed: totalFailed, errors });
    return { inserted, updated, failed: totalFailed, errors };
  }, [rows, supplyChainId, template, fileName, queryClient, isHistorical]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
    setParseError(null);
    setParsing(false);
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
    loadFile,
    submit,
    reset,
  };
}
