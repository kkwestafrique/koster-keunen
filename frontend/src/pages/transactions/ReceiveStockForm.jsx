import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { CURRENCIES, PRODUCTS, UNITS, STANDARDS } from '@/data/regions';
import { useAllVillagesLite } from '@/hooks/useVillages';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useBulkUpload, downloadTemplate } from '@/hooks/useBulkUpload';
import { useToast } from '@/hooks/use-toast';

const EMPTY_PRODUCT_ROW = { product: '', quantity: '', unit: 'Kg', price: '' };

// Full-page Receive stock form (Transactions > Received), matching the live
// site: Single transaction (Standard -> Village -> Beekeeper cascade) or
// Multiple transaction (Excel template download + upload).
export default function ReceiveStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();
  const bulkUpload = useBulkUpload('transactions');

  const [mode, setMode] = useState('single');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    standard: '',
    village_id: '',
    beekeeper_id: '',
    currency: 'NGN',
    products: [{ ...EMPTY_PRODUCT_ROW }],
    transaction_date: '',
  });

  const { data: villages = [] } = useAllVillagesLite();
  // Cascade: beekeeper list filters to the chosen village only
  const { data: beekeeperData } = useBeekeepers({ villageId: form.village_id });
  const beekeepers = form.village_id ? (beekeeperData?.rows || []) : [];

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setProductRow = (idx, patch) =>
    setForm((f) => ({ ...f, products: f.products.map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));

  const singleValid = form.standard && form.village_id && form.beekeeper_id
    && form.transaction_date && form.products.every((p) => p.product && p.quantity);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createTransaction.mutateAsync({
        direction: 'Received',
        standard: form.standard,
        beekeeper_id: form.beekeeper_id,
        currency: form.currency,
        products: form.products,
        quantity: form.products.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
        total_amount: form.products.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.price) || 0), 0),
        transaction_date: form.transaction_date,
      });
      toast({ title: t('receiveForm.created') });
      navigate('/transactions/received');
    } catch (err) {
      toast({ title: t('receiveForm.createFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('receiveForm.title')}</h1>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl">
        <RadioGroup value={mode} onValueChange={setMode} className="flex gap-8 mb-6" data-testid="receive-mode">
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="single" data-testid="receive-mode-single" /> {t('receiveForm.singleTransaction')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="multiple" data-testid="receive-mode-multiple" /> {t('receiveForm.multipleTransaction')}
          </label>
        </RadioGroup>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 max-w-sm">
            <Label className="text-[#7089b4]">{t('contractWizard.standard')}</Label>
            <Select value={form.standard} onValueChange={set('standard')}>
              <SelectTrigger data-testid="receive-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
              <SelectContent>
                {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mode === 'single' && form.standard && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('receiveForm.village')}</Label>
                  <Select value={form.village_id} onValueChange={(v) => setForm((f) => ({ ...f, village_id: v, beekeeper_id: '' }))}>
                    <SelectTrigger data-testid="receive-village"><SelectValue placeholder={t('forms.selectVillage')} /></SelectTrigger>
                    <SelectContent>
                      {villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('receiveForm.beekeeperFullName')}</Label>
                  <Select value={form.beekeeper_id} onValueChange={set('beekeeper_id')} disabled={!form.village_id}>
                    <SelectTrigger data-testid="receive-beekeeper">
                      <SelectValue placeholder={form.village_id ? t('receiveForm.selectBeekeeper') : t('receiveForm.selectVillageFirst')} />
                    </SelectTrigger>
                    <SelectContent>
                      {beekeepers.map((b) => <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('contractWizard.currency')}</Label>
                  <Select value={form.currency} onValueChange={set('currency')}>
                    <SelectTrigger data-testid="receive-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4]">{t('receiveForm.transactionDate')}</Label>
                  <Input type="date" data-testid="receive-date" value={form.transaction_date} onChange={(e) => set('transaction_date')(e.target.value)} />
                </div>
              </div>

              <Label className="text-[#032b71] font-bold mt-2">{t('contractWizard.products')}</Label>
              {form.products.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4] text-xs">{t('contractWizard.product')}</Label>
                    <Select value={row.product} onValueChange={(v) => setProductRow(idx, { product: v })}>
                      <SelectTrigger><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4] text-xs">{t('receiveForm.quantity')}</Label>
                    <Input type="number" min="0" value={row.quantity} onChange={(e) => setProductRow(idx, { quantity: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4] text-xs">{t('contractWizard.unit')}</Label>
                    <Select value={row.unit} onValueChange={(v) => setProductRow(idx, { unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[#7089b4] text-xs">{t('contractWizard.price')}</Label>
                    <Input type="number" min="0" value={row.price} onChange={(e) => setProductRow(idx, { price: e.target.value })} />
                  </div>
                  {form.products.length > 1 && (
                    <Button type="button" variant="ghost" className="text-[#ba550c]" onClick={() => setForm((f) => ({ ...f, products: f.products.filter((_, i) => i !== idx) }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-fit border-[#0f48aa] text-[#0f48aa]"
                data-testid="receive-add-product"
                onClick={() => setForm((f) => ({ ...f, products: [...f.products, { ...EMPTY_PRODUCT_ROW }] }))}
              >
                <Plus className="h-4 w-4 mr-1" /> {t('receiveForm.addMoreProduct')}
              </Button>

              <div className="flex justify-between mt-4">
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/transactions/received')}>
                  {t('contractWizard.back')}
                </Button>
                <Button type="button" data-testid="receive-submit" disabled={!singleValid || saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
                  {saving ? t('forms.saving') : t('receiveForm.submit')}
                </Button>
              </div>
            </>
          )}

          {mode === 'multiple' && form.standard && (
            <div className="bg-[#fffaec] border border-[#f2e4b3] rounded-[5px] p-5 flex flex-col gap-4" data-testid="receive-multiple-block">
              <div>
                <p className="text-sm font-bold text-[#032b71] mb-1">1. {t('receiveForm.downloadTemplate')}</p>
                <p className="text-xs text-[#7089b4] mb-3">{t('receiveForm.templateNote')}</p>
                <div className="flex flex-col gap-3 max-w-sm">
                  <Select value={form.currency} onValueChange={set('currency')}>
                    <SelectTrigger data-testid="receive-multi-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit border-[#0f48aa] text-[#0f48aa]"
                    data-testid="receive-download-template"
                    onClick={() => downloadTemplate('transactions', 'received-transactions-template.xlsx')}
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
                    data-testid="receive-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) bulkUpload.loadFile(file);
                    }}
                  />
                  <span className="inline-flex items-center gap-1 bg-[#0f48aa] text-white hover:bg-[#0d3d91] rounded-[5px] px-4 py-2 text-sm font-medium cursor-pointer" data-testid="receive-upload-verify">
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
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#cfd8e6] text-[#032b71]"
                        data-testid="receive-bulk-reset"
                        onClick={bulkUpload.reset}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button
                        type="button"
                        data-testid="receive-bulk-submit"
                        disabled={bulkUpload.validCount === 0 || bulkUpload.uploading}
                        className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
                        onClick={async () => {
                          const res = await bulkUpload.submit();
                          if (res.inserted > 0) {
                            toast({ title: t('receiveForm.bulkImportComplete', { count: res.inserted }) });
                            navigate('/transactions/received');
                          } else {
                            toast({ title: t('receiveForm.bulkImportFailed'), variant: 'destructive' });
                          }
                        }}
                      >
                        {bulkUpload.uploading
                          ? t('forms.saving')
                          : t('receiveForm.importValidRows', { count: bulkUpload.validCount })}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
