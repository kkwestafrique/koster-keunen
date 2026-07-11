import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload } from 'lucide-react';
import { CURRENCIES, PRODUCTS, STANDARDS } from '@/data/regions';
import { useAllActorsLite } from '@/hooks/useActors';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useBulkUpload, downloadTemplate } from '@/hooks/useBulkUpload';
import { useToast } from '@/hooks/use-toast';

// Send stock form (Transactions > Send). Per the live-site audit:
// Single: Standard -> Destination actor -> Product -> Quantity required to
// deliver -> Price -> Currency (auto-populates to NGN once an actor is
// chosen) -> Invoice number -> BL number -> Transaction date.
// Multiple: same Excel template download + upload-and-verify flow as
// Received (confirmed present under Send per the audit's Key Findings,
// though the live modal wasn't screenshotted in detail — this mirrors the
// Received flow's shape, which is the only confirmed pattern).
export default function SendStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: actors = [] } = useAllActorsLite();
  const createTransaction = useCreateTransaction();
  const bulkUpload = useBulkUpload('transactions');

  const [mode, setMode] = useState('single');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    standard: '',
    destination_actor_id: '',
    product: '',
    quantity: '',
    price: '',
    currency: '',
    invoice_number: '',
    bl_number: '',
    transaction_date: '',
  });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const valid = form.standard && form.destination_actor_id && form.product
    && form.quantity && form.transaction_date;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createTransaction.mutateAsync({
        direction: 'Send',
        standard: form.standard,
        actor_id: form.destination_actor_id,
        product: form.product,
        quantity: Number(form.quantity) || 0,
        total_amount: (Number(form.quantity) || 0) * (Number(form.price) || 0),
        currency: form.currency,
        invoice_number: form.invoice_number,
        bl_number: form.bl_number,
        transaction_date: form.transaction_date,
      });
      toast({ title: t('sendForm.created') });
      navigate('/transactions/send');
    } catch (err) {
      toast({ title: t('sendForm.createFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('sendForm.title')}</h1>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl">
        <RadioGroup value={mode} onValueChange={setMode} className="flex gap-8 mb-6" data-testid="send-mode">
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="single" data-testid="send-mode-single" /> {t('receiveForm.singleTransaction')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="multiple" data-testid="send-mode-multiple" /> {t('receiveForm.multipleTransaction')}
          </label>
        </RadioGroup>

        {mode === 'single' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.standard')}</Label>
                <Select value={form.standard} onValueChange={set('standard')}>
                  <SelectTrigger data-testid="send-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
                  <SelectContent>
                    {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('sendForm.destinationActor')}</Label>
                <Select
                  value={form.destination_actor_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, destination_actor_id: v, currency: f.currency || 'NGN' }))}
                >
                  <SelectTrigger data-testid="send-actor"><SelectValue placeholder={t('forms.selectActor')} /></SelectTrigger>
                  <SelectContent>
                    {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.product')}</Label>
                <Select value={form.product} onValueChange={set('product')}>
                  <SelectTrigger data-testid="send-product"><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('sendForm.quantityRequired')}</Label>
                <Input type="number" min="0" data-testid="send-quantity" value={form.quantity} onChange={(e) => set('quantity')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.price')}</Label>
                <Input type="number" min="0" data-testid="send-price" value={form.price} onChange={(e) => set('price')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('contractWizard.currency')}</Label>
                <Select value={form.currency} onValueChange={set('currency')}>
                  <SelectTrigger data-testid="send-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('sendForm.invoiceNumber')}</Label>
                <Input data-testid="send-invoice" value={form.invoice_number} onChange={(e) => set('invoice_number')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('sendForm.blNumber')}</Label>
                <Input data-testid="send-bl" value={form.bl_number} onChange={(e) => set('bl_number')(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('receiveForm.transactionDate')}</Label>
                <Input type="date" data-testid="send-date" value={form.transaction_date} onChange={(e) => set('transaction_date')(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/transactions/send')}>
                {t('contractWizard.back')}
              </Button>
              <Button type="button" data-testid="send-submit" disabled={!valid || saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
                {saving ? t('forms.saving') : t('sendForm.submit')}
              </Button>
            </div>
          </>
        )}

        {mode === 'multiple' && (
          <div className="bg-[#fffaec] border border-[#f2e4b3] rounded-[5px] p-5 flex flex-col gap-4" data-testid="send-multiple-block">
            <div>
              <p className="text-sm font-bold text-[#032b71] mb-1">1. {t('receiveForm.downloadTemplate')}</p>
              <p className="text-xs text-[#7089b4] mb-3">{t('receiveForm.templateNote')}</p>
              <div className="flex flex-col gap-3 max-w-sm">
                <Select value={form.currency} onValueChange={set('currency')}>
                  <SelectTrigger data-testid="send-multi-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit border-[#0f48aa] text-[#0f48aa]"
                  data-testid="send-download-template"
                  onClick={() => downloadTemplate('transactions', 'send-transactions-template.xlsx')}
                >
                  <Download className="h-4 w-4 mr-1" /> {t('receiveForm.downloadTemplate')}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#032b71] mb-2">2. {t('receiveForm.uploadAndVerify')}</p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  data-testid="send-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) bulkUpload.loadFile(file);
                  }}
                />
                <span className="inline-flex items-center gap-1 bg-[#0f48aa] text-white hover:bg-[#0d3d91] rounded-[5px] px-4 py-2 text-sm font-medium cursor-pointer" data-testid="send-upload-verify">
                  <Upload className="h-4 w-4" /> {t('receiveForm.uploadFileVerify')}
                </span>
              </label>
              {bulkUpload.fileName && (
                <span className="ml-3 text-sm text-[#7089b4]">{bulkUpload.fileName}</span>
              )}

              {bulkUpload.rows.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-[#032b71] mb-2">
                    {t('receiveForm.validRows', { count: bulkUpload.validCount })}
                    {bulkUpload.errorCount > 0 && (
                      <span className="text-[#ba550c]"> · {t('receiveForm.errorRows', { count: bulkUpload.errorCount })}</span>
                    )}
                  </p>
                  <div className="max-h-64 overflow-y-auto border border-[#cfd8e6] rounded-[5px]">
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
                              {r.errors.length === 0 ? (
                                <span className="text-[#219653] font-bold">{t('receiveForm.valid')}</span>
                              ) : (
                                <span className="text-[#ba550c] font-bold">{t('receiveForm.invalid')}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-[#7089b4]">{r.errors.join('; ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 mt-3">
                    <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" data-testid="send-bulk-reset" onClick={bulkUpload.reset}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="button"
                      data-testid="send-bulk-submit"
                      disabled={bulkUpload.validCount === 0 || bulkUpload.uploading}
                      className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                      onClick={async () => {
                        const res = await bulkUpload.submit();
                        if (res.inserted > 0) {
                          toast({ title: t('receiveForm.bulkImportComplete', { count: res.inserted }) });
                          navigate('/transactions/send');
                        } else {
                          toast({ title: t('receiveForm.bulkImportFailed'), variant: 'destructive' });
                        }
                      }}
                    >
                      {bulkUpload.uploading ? t('forms.saving') : t('receiveForm.importValidRows', { count: bulkUpload.validCount })}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
