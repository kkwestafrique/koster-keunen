import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { CURRENCIES, PRODUCTS, UNITS, STANDARDS } from '@/data/regions';
import { useBeekeepers } from '@/hooks/useBeekeepers';
import { useActingActor } from '@/hooks/useActors';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useBulkUpload, downloadTemplate } from '@/hooks/useBulkUpload';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import SummaryField from '@/components/common/SummaryField';

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
  const { isReadOnly } = useActingActor();

  const [mode, setMode] = useState('single');
  const [step, setStep] = useState(1); // 1 = fill in, 2 = review before confirming (single mode only -- multiple/bulk mode already has its own review table before import)
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    standard: '',
    village_id: '',
    beekeeper_id: '',
    currency: 'NGN',
    products: [{ ...EMPTY_PRODUCT_ROW }],
    transaction_date: '',
  });

  // Real dead-end found live: the Village filter used to list every
  // village in the whole supply chain (useAllVillagesLite), regardless
  // of whether the current actor had any beekeepers there at all.
  // Picking a real village with zero of your own beekeepers in it
  // silently emptied the Beekeeper dropdown with no explanation why.
  // Fixed by deriving the Village options directly from this actor's
  // own beekeeper data -- a village can only ever appear here if it
  // genuinely has at least one beekeeper behind it.
  const { data: allBeekeeperData } = useBeekeepers({ pageSize: 200 });
  const villages = React.useMemo(() => {
    const rows = allBeekeeperData?.rows || [];
    const seen = new Map();
    rows.forEach((b) => {
      if (b.village_id && !seen.has(b.village_id)) {
        seen.set(b.village_id, { id: b.village_id, name: b.villages?.name || b.village_id });
      }
    });
    return Array.from(seen.values());
  }, [allBeekeeperData]);
  const allBeekeepers = allBeekeeperData?.rows || [];
  const beekeepers = form.village_id
    ? allBeekeepers.filter((b) => b.village_id === form.village_id)
    : allBeekeepers;

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setProductRow = (idx, patch) =>
    setForm((f) => ({ ...f, products: f.products.map((row, i) => (i === idx ? { ...row, ...patch } : row)) }));

  const singleValid = form.standard && form.beekeeper_id
    && form.transaction_date && form.products.every((p) => p.product && p.quantity);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createTransaction.mutateAsync({
        direction: 'Received',
        // Explicit, not left to the transactions table's own default —
        // confirmed bug: that default is 'Approved' for every row
        // regardless of direction, which silently skipped the entire
        // Approve/Reject workflow for every new Received transaction.
        status: 'Pending',
        standard: form.standard,
        beekeeper_id: form.beekeeper_id,
        currency: form.currency,
        products: form.products,
        transaction_date: form.transaction_date,
      });
      toast({ title: t('receiveForm.created') });
      navigate('/transactions');
    } catch (err) {
      toast({ title: t('receiveForm.createFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('receiveForm.title')}</h1>

      {isReadOnly ? (
        <div className="bg-[#fdecea] border border-[#f3b8b3] rounded-[5px] p-6 max-w-lg" data-testid="receive-form-readonly-block">
          <p className="text-sm text-[#ba550c] font-bold mb-3">{t('common.readOnlyActorTooltip')}</p>
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/transactions')}>
            {t('contractWizard.back')}
          </Button>
        </div>
      ) : (
      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl">
        <RadioGroup value={mode} onValueChange={(v) => { setMode(v); setStep(1); }} className="flex gap-8 mb-6" data-testid="receive-mode">
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="single" data-testid="receive-mode-single" /> {t('receiveForm.singleTransaction')}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
            <RadioGroupItem value="multiple" data-testid="receive-mode-multiple" /> {t('receiveForm.multipleTransaction')}
          </label>
        </RadioGroup>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 max-w-sm">
            <Label htmlFor="receive-standard" className="text-[#5a6f9a]">{t('contractWizard.standard')}</Label>
            <Select value={form.standard} onValueChange={set('standard')}>
              <SelectTrigger id="receive-standard" data-testid="receive-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
              <SelectContent>
                {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mode === 'single' && form.standard && step === 1 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receive-village" className="text-[#5a6f9a]">{t('receiveForm.village')}</Label>
                  <Select value={form.village_id} onValueChange={(v) => setForm((f) => ({ ...f, village_id: v, beekeeper_id: '' }))}>
                    <SelectTrigger id="receive-village" data-testid="receive-village"><SelectValue placeholder={t('forms.selectVillage')} /></SelectTrigger>
                    <SelectContent>
                      {villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receive-beekeeper" className="text-[#5a6f9a]">{t('receiveForm.beekeeperFullName')}</Label>
                  <Select value={form.beekeeper_id} onValueChange={set('beekeeper_id')}>
                    <SelectTrigger id="receive-beekeeper" data-testid="receive-beekeeper">
                      <SelectValue placeholder={t('receiveForm.selectBeekeeper')} />
                    </SelectTrigger>
                    <SelectContent>
                      {beekeepers.map((b) => <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {beekeepers.length === 0 && (
                    <p className="text-xs text-[#ba550c]" data-testid="receive-no-beekeepers">{t('receiveForm.noBeekeepersFound')}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receive-currency" className="text-[#5a6f9a]">{t('contractWizard.currency')}</Label>
                  <Select value={form.currency} onValueChange={set('currency')}>
                    <SelectTrigger id="receive-currency" data-testid="receive-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="receive-date" className="text-[#5a6f9a]">{t('receiveForm.transactionDate')}</Label>
                  <Input id="receive-date" type="date" data-testid="receive-date" min="1900-01-01" max="2100-12-31" value={form.transaction_date} onChange={(e) => set('transaction_date')(e.target.value)} />
                </div>
              </div>

              <span className="text-[#032b71] font-bold mt-2 block">{t('contractWizard.products')}</span>
              {form.products.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`receive-product-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.product')}</Label>
                    <Select value={row.product} onValueChange={(v) => setProductRow(idx, { product: v })}>
                      <SelectTrigger id={`receive-product-${idx}`} data-testid={`receive-product-${idx}`}><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`receive-quantity-${idx}`} className="text-[#5a6f9a] text-xs">{t('receiveForm.quantity')}</Label>
                    <Input id={`receive-quantity-${idx}`} data-testid={`receive-quantity-${idx}`} type="number" min="0" value={row.quantity} onChange={(e) => setProductRow(idx, { quantity: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`receive-unit-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.unit')}</Label>
                    <Select value={row.unit} onValueChange={(v) => setProductRow(idx, { unit: v })}>
                      <SelectTrigger id={`receive-unit-${idx}`} data-testid={`receive-unit-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`receive-price-${idx}`} className="text-[#5a6f9a] text-xs">{t('contractWizard.price')}</Label>
                    <Input id={`receive-price-${idx}`} data-testid={`receive-price-${idx}`} type="number" min="0" value={row.price} onChange={(e) => setProductRow(idx, { price: e.target.value })} />
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
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/transactions')}>
                  {t('contractWizard.back')}
                </Button>
                <Button type="button" data-testid="receive-review" disabled={!singleValid} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={() => setStep(2)}>
                  {t('contractWizard.reviewAndConfirm')}
                </Button>
              </div>
            </>
          )}

          {mode === 'single' && form.standard && step === 2 && (
            <div className="flex flex-col gap-4" data-testid="receive-review-step">
              <h2 className="text-base font-black text-[#032b71] mb-2">{t('contractWizard.reviewTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                <SummaryField label={t('contractWizard.standard')} value={form.standard} />
                <SummaryField label={t('receiveForm.village')} value={villages.find((v) => v.id === form.village_id)?.name} />
                <SummaryField label={t('receiveForm.beekeeperFullName')} value={beekeepers.find((b) => b.id === form.beekeeper_id)?.full_name} />
                <SummaryField label={t('contractWizard.currency')} value={form.currency} />
                <SummaryField label={t('receiveForm.transactionDate')} value={form.transaction_date} />
              </div>

              <table className="w-full text-sm mb-2">
                <thead>
                  <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
                    <th className="py-2">{t('contractWizard.product')}</th>
                    <th className="py-2">{t('receiveForm.quantity')}</th>
                    <th className="py-2">{t('contractWizard.unit')}</th>
                    <th className="py-2">{t('contractWizard.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {form.products.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#f0f0f0] text-[#032b71]">
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.quantity}</td>
                      <td className="py-2">{row.unit}</td>
                      <td className="py-2">{row.price || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between mt-2">
                <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" data-testid="receive-review-back" onClick={() => setStep(1)}>
                  {t('contractWizard.back')}
                </Button>
                <Button type="button" data-testid="receive-submit" disabled={saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
                  {saving ? t('forms.saving') : t('receiveForm.submit')}
                </Button>
              </div>
            </div>
          )}

          {mode === 'multiple' && form.standard && (
            <div className="bg-[#fffaec] border border-[#f2e4b3] rounded-[5px] p-5 flex flex-col gap-4" data-testid="receive-multiple-block">
              <div>
                <p className="text-sm font-bold text-[#032b71] mb-1">1. {t('receiveForm.downloadTemplate')}</p>
                <p className="text-xs text-[#5a6f9a] mb-3">{t('receiveForm.templateNote')}</p>
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
                    onClick={() => { downloadTemplate('transactions', 'received-transactions-template.xlsx'); toast({ title: t('common.templateDownloaded') }); }}
                  >
                    <Download className="h-4 w-4 mr-1" /> {t('receiveForm.downloadTemplate')}
                  </Button>
                </div>
                <label className="flex items-start gap-2 mt-3 max-w-md cursor-pointer" data-testid="receive-historical-toggle-label">
                  <Checkbox
                    data-testid="receive-historical-toggle"
                    checked={bulkUpload.isHistorical}
                    onCheckedChange={(v) => bulkUpload.setIsHistorical(!!v)}
                  />
                  <span className="text-xs text-[#5a6f9a]">
                    <span className="font-bold text-[#032b71]">{t('receiveForm.historicalDataLabel')}</span>
                    {' '}{t('receiveForm.historicalDataNote')}
                  </span>
                </label>
              </div>
              <div>
                <p className="text-sm font-bold text-[#032b71] mb-2">2. {t('receiveForm.uploadAndVerify')}</p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    data-testid="receive-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // parseError state (surfaced below) already carries
                      // the message — this .catch() just prevents the
                      // rejection itself from becoming an unhandled
                      // promise rejection / dev error overlay.
                      if (file) bulkUpload.loadFile(file).catch(() => {});
                    }}
                  />
                  <span className="inline-flex items-center gap-1 bg-[#0f48aa] text-white hover:bg-[#0d3d91] rounded-[5px] px-4 py-2 text-sm font-medium cursor-pointer" data-testid="receive-upload-verify">
                    <Upload className="h-4 w-4" /> {t('receiveForm.uploadFileVerify')}
                  </span>
                </label>
                {bulkUpload.fileName && (
                  <span className="ml-3 text-sm text-[#5a6f9a]">{bulkUpload.fileName}</span>
                )}
                {bulkUpload.parseError && (
                  <p className="mt-2 text-sm text-[#ba550c] font-bold" data-testid="receive-bulk-parse-error">
                    {bulkUpload.parseError}
                  </p>
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
                          <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
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
                              <td className="py-1.5 px-3 text-[#5a6f9a]">{r.errors.join('; ') || '—'}</td>
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
                          const res = await bulkUpload.submit({ currency: form.currency });
                          if (res.inserted > 0) {
                            if (res.shortfallCount > 0) {
                              toast({
                                title: t('receiveForm.bulkImportComplete', { count: res.inserted }),
                                description: t('receiveForm.bulkImportShortfallWarning', { count: res.shortfallCount }),
                              });
                            } else {
                              toast({ title: t('receiveForm.bulkImportComplete', { count: res.inserted }) });
                            }
                            navigate('/transactions');
                          } else {
                            toast({
                              title: t('receiveForm.bulkImportFailed'),
                              description: res.errors?.[0],
                              variant: 'destructive',
                            });
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
      )}
    </AppLayout>
  );
}
