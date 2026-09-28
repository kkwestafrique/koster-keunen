import * as XLSX from 'xlsx';
import { filterBlankRows } from '../domain/rows';

export function parseFile(file, template) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          // Templates with a group-header row (currently just Beekeepers)
          // have the real column names on row 2, not row 1 -- range: 1
          // skips row 1 entirely so sheet_to_json uses row 2 as headers,
          // matching exactly what downloadTemplate generated. Without
          // this, the group labels themselves (repeated across several
          // columns, e.g. "Biographic data" for both Full name and
          // Gender) would be used as the column keys instead, and since
          // object keys must be unique, every column sharing a group
          // would silently collide and overwrite the last one.
          const hasGroups = template?.columns?.some((c) => c.group);
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', range: hasGroups ? 1 : 0 });
          const realRows = filterBlankRows(rows, template);
          resolve(realRows);
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
