import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Column definitions per target table. "required" fields must be present and non-empty on every row.
export const BULK_UPLOAD_TEMPLATES = {
  beekeepers: {
    label: 'Beekeepers',
    table: 'beekeepers',
    uploadType: 'Connections', // matches bulk_uploads.upload_type CHECK constraint
    columns: [
      { key: 'traceability_code', label: 'Traceability code', required: true },
      { key: 'full_name', label: 'Full name', required: true },
      { key: 'gender', label: 'Gender', required: false, allowed: ['Male', 'Female'] },
      { key: 'village_name', label: 'Village', required: false },
      { key: 'hives_traditional_single', label: 'Hives traditional single', required: false, type: 'number' },
      { key: 'hives_traditional_double', label: 'Hives traditional double', required: false, type: 'number' },
      { key: 'hives_modern', label: 'Hives modern', required: false, type: 'number' },
      { key: 'hives_other', label: 'Hives other', required: false, type: 'number' },
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
      { key: 'total_amount', label: 'Total amount', required: false, type: 'number' },
      { key: 'direction', label: 'Direction', required: true, allowed: ['Received', 'Processing', 'Send'] },
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
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
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
      reject(new Error('Unsupported file type. Please upload a .csv or .xlsx file.'));
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

  if (templateKey === 'transactions') {
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

function validateRows(rows, template, lookups) {
  return rows.map((row, index) => {
    const errors = [];
    const cleaned = {};

    template.columns.forEach((col) => {
      let value = row[col.label] ?? row[col.key] ?? '';
      if (typeof value === 'string') value = value.trim();

      if (col.required && (value === '' || value === undefined || value === null)) {
        errors.push(`${col.label} is required`);
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
    }

    return { rowNumber: index + 2, data: cleaned, errors };
  });
}

export function useBulkUpload(templateKey) {
  const { supplyChainId } = useAuth();
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);

  const loadFile = useCallback(async (file) => {
    setFileName(file.name);
    setResult(null);
    setParsing(true);
    try {
      const [rawRows, lookups] = await Promise.all([
        parseFile(file),
        fetchLookups(supplyChainId, templateKey),
      ]);
      setRows(validateRows(rawRows, template, lookups));
    } finally {
      setParsing(false);
    }
  }, [template, templateKey, supplyChainId]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const submit = useCallback(async () => {
    setUploading(true);
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => ({
      ...r.data,
      supply_chain_id: supplyChainId,
    }));
    const validationFailedCount = rows.length - validRows.length;

    let inserted = 0;
    let failed = 0;
    const errors = [];

    // Insert in batches of 100 to avoid oversized payloads
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase.from(template.table).insert(batch).select('*', { count: 'exact' });
      if (error) {
        failed += batch.length;
        errors.push(error.message);
      } else {
        inserted += count ?? batch.length;
      }
    }

    const totalFailed = failed + validationFailedCount;

    // Log this upload to bulk_uploads so the Bulk Uploads history page
    // (Connections/Transactions tabs) actually reflects real activity,
    // instead of always showing empty.
    try {
      await supabase.from('bulk_uploads').insert({
        supply_chain_id: supplyChainId,
        upload_type: template.uploadType,
        file_name: fileName,
        status: inserted === 0 ? 'Failed' : 'Completed',
        progress: 100,
        ...(template.uploadType === 'Connections'
          ? { new_beekeepers: inserted, updated_beekeepers: 0 }
          : {}),
      });
    } catch (logErr) {
      // Don't let a logging failure block the person from seeing their
      // actual import result — just note it happened.
      console.error('Failed to log bulk upload history:', logErr);
    }

    setUploading(false);
    setResult({ inserted, failed: totalFailed, errors });
    return { inserted, failed: totalFailed, errors };
  }, [rows, supplyChainId, template, fileName]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
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
    result,
    loadFile,
    submit,
    reset,
  };
}
