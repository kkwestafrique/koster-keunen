import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useBulkUpload, downloadTemplate } from '@/hooks/useBulkUpload';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// Bulk-import historical Contracts — same download-template / upload-and-
// verify / submit shape as the Received transactions and Beekeepers bulk
// flows, reusing the same useBulkUpload infrastructure. One spreadsheet
// row = one contract (one product each), matching what the interactive
// Contract wizard itself inserts per product line.
export default function BulkImportContractsDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const bulkUpload = useBulkUpload('contracts');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    bulkUpload.loadFile(file).catch((err) => {
      toast({ title: t('forms.fileParseFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    });
  };

  const handleSubmit = async () => {
    const res = await bulkUpload.submit();
    if (res.inserted > 0) {
      toast({ title: t('contracts.bulkImportComplete', { count: res.inserted }) });
      bulkUpload.reset();
      onOpenChange(false);
    } else {
      toast({ title: t('contracts.bulkImportFailed'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) bulkUpload.reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl" data-testid="contracts-bulk-import-dialog">
        <DialogHeader>
          <DialogTitle>{t('contracts.bulkImportTitle')}</DialogTitle>
          <DialogDescription>{t('contracts.bulkImportDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-fit border-[#0f48aa] text-[#0f48aa]"
            data-testid="contracts-download-template"
            onClick={() => downloadTemplate('contracts', 'historical-contracts-template.xlsx')}
          >
            <Download className="h-4 w-4 mr-1" /> {t('receiveForm.downloadTemplate')}
          </Button>

          <label className="inline-block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              data-testid="contracts-bulk-file-input"
              onChange={handleFileChange}
            />
            <span
              className="inline-flex items-center gap-1 bg-[#0f48aa] text-white hover:bg-[#0d3d91] rounded-[5px] px-4 py-2 text-sm font-medium cursor-pointer"
              data-testid="contracts-bulk-upload-verify"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> {t('receiveForm.uploadFileVerify')}
            </span>
          </label>
          {bulkUpload.fileName && <span className="text-sm text-[#7089b4]">{bulkUpload.fileName}</span>}
          {bulkUpload.parseError && (
            <p className="text-sm text-[#ba550c] font-bold" data-testid="contracts-bulk-parse-error">{bulkUpload.parseError}</p>
          )}

          {bulkUpload.rows.length > 0 && (
            <div>
              <p className="text-sm text-[#032b71] mb-2">
                {t('receiveForm.validRows', { count: bulkUpload.validCount })}
                {bulkUpload.errorCount > 0 && (
                  <span className="text-[#ba550c]"> · {t('receiveForm.errorRows', { count: bulkUpload.errorCount })}</span>
                )}
              </p>
              <div className="max-h-56 overflow-y-auto border border-[#cfd8e6] rounded-[5px]">
                <table className="w-full text-xs">
                  <thead className="bg-white sticky top-0">
                    <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                      <th className="py-2 px-3">{t('receiveForm.row')}</th>
                      <th className="py-2 px-3">{t('receiveForm.status')}</th>
                      <th className="py-2 px-3">{t('receiveForm.issues')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkUpload.rows.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-[#f0f0f0]">
                        <td className="py-1.5 px-3 text-[#032b71]">{r.rowNumber}</td>
                        <td className="py-1.5 px-3">
                          {r.errors.length === 0
                            ? <span className="text-[#219653] font-bold">{t('receiveForm.valid')}</span>
                            : <span className="text-[#ba550c] font-bold">{t('receiveForm.invalid')}</span>}
                        </td>
                        <td className="py-1.5 px-3 text-[#7089b4]">{r.errors.join('; ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            data-testid="contracts-bulk-submit"
            disabled={bulkUpload.validCount === 0 || bulkUpload.uploading}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            onClick={handleSubmit}
          >
            {bulkUpload.uploading ? t('forms.saving') : t('receiveForm.importValidRows', { count: bulkUpload.validCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
