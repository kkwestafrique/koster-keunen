import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadCloud, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useBulkUpload, BULK_UPLOAD_TEMPLATES } from '@/hooks/useBulkUpload';

export default function BulkUploads() {
  const { t } = useTranslation();
  const [templateKey, setTemplateKey] = useState('beekeepers');
  const fileInputRef = useRef(null);

  const {
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
  } = useBulkUpload(templateKey);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleTemplateChange = (v) => {
    setTemplateKey(v);
    reset();
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.bulkUploads')}</h1>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-[#7089b4]">Upload type:</span>
        <Select value={templateKey} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-[220px] bg-white border-[#cfd8e6] text-[#032b71]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BULK_UPLOAD_TEMPLATES).map(([key, tmpl]) => (
              <SelectItem key={key} value={key}>{tmpl.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div
          className="bg-white border border-dashed border-[#cfd8e6] rounded-[5px] p-16 flex flex-col items-center justify-center gap-3 text-center cursor-pointer"
          data-testid="bulk-uploads-dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="h-10 w-10 text-[#7089b4]" />
          <p className="text-sm text-[#032b71] font-medium">Drag and drop a file here, or click to browse</p>
          <p className="text-xs text-[#7089b4]">Supports .xlsx and .csv</p>
          <p className="text-xs text-[#7089b4]">
            Required columns: {template.columns.filter((c) => c.required).map((c) => c.label).join(', ')}
          </p>
          <Button className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] mt-2">Choose file</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            data-testid="bulk-uploads-file-input"
          />
        </div>
      ) : (
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[#032b71]">{fileName}</p>
              <p className="text-xs text-[#7089b4]">
                {rows.length} rows found — <span className="text-[#219653] font-semibold">{validCount} valid</span>
                {errorCount > 0 && (
                  <span className="text-[#ba550c] font-semibold"> · {errorCount} with errors</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-[#0f48aa] text-[#0f48aa]" onClick={reset}>
                Cancel
              </Button>
              <Button
                className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                disabled={validCount === 0 || uploading}
                onClick={submit}
                data-testid="bulk-uploads-submit"
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Import {validCount} row{validCount === 1 ? '' : 's'}
              </Button>
            </div>
          </div>

          {result && (
            <div
              className={`mb-4 rounded-[5px] p-3 text-sm ${
                result.failed > 0 ? 'bg-[#fff4f4] text-[#ba550c]' : 'bg-[#edf9f2] text-[#1ba441]'
              }`}
            >
              {result.inserted} row(s) imported successfully.
              {result.failed > 0 && ` ${result.failed} row(s) failed: ${result.errors.join('; ')}`}
            </div>
          )}

          <div className="max-h-[420px] overflow-auto border border-[#cfd8e6] rounded-[5px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#cfd8e6]">
                  <th className="text-left px-3 py-2 text-[#7089b4] font-bold">Row</th>
                  {template.columns.map((col) => (
                    <th key={col.key} className="text-left px-3 py-2 text-[#7089b4] font-bold">
                      {col.label}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 text-[#7089b4] font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#cfd8e6] last:border-0 ${
                      i % 2 === 0 ? 'bg-[#f9fafc]' : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2 text-[#032b71]">{row.rowNumber}</td>
                    {template.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-[#032b71]">
                        {String(row.data[col.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#1ba441] text-xs font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[#ba550c] text-xs font-semibold"
                          title={row.errors.join('; ')}
                        >
                          <XCircle className="h-3.5 w-3.5" /> {row.errors.length} error(s)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
