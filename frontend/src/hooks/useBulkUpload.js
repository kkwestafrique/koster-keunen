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

function validateRows(rows, template) {
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

      cleaned[col.key] = col.type === 'number' && value !== '' ? Number(value) : value;
    });

    return { rowNumber: index + 2, data: cleaned, errors };
  });
}

export function useBulkUpload(templateKey) {
  const { supplyChainId } = useAuth();
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const loadFile = useCallback(async (file) => {
    setFileName(file.name);
    setResult(null);
    const rawRows = await parseFile(file);
    setRows(validateRows(rawRows, template));
  }, [template]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const submit = useCallback(async () => {
    setUploading(true);
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => ({
      ...r.data,
      supply_chain_id: supplyChainId,
    }));

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

    setUploading(false);
    setResult({ inserted, failed, errors });
    return { inserted, failed, errors };
  }, [rows, supplyChainId, template]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
  }, []);

  return {
    template,
    rows,
    fileName,
    validCount,
    errorCount,
    uploading,
    result,
    loadFile,
    submit,
    reset,
  };
}
