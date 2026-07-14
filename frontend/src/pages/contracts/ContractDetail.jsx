import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import RequiredLabel from '@/components/common/RequiredLabel';
import StandardBadge from '@/components/common/StandardBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useContract, useUpdateContractGroup } from '@/hooks/useContracts';
import { uploadMediaFile } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const today = () => new Date().toISOString().slice(0, 10);

// Update-contract modal: matches the live site exactly — Year/Actor/
// Standard are read-only (greyed), only per-line-item Expected quantity/
// Maximum price, the attached file, Advance amount paid, and Updated on
// can change. This is a MODAL overlay, not the wizard reopened.
function UpdateContractModal({ open, onOpenChange, contract }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { supplyChainId } = useAuth();
  const updateGroup = useUpdateContractGroup();
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [products, setProducts] = useState(() => contract.products.map((p) => ({ ...p })));
  const [advanceAmountPaid, setAdvanceAmountPaid] = useState(contract.advance_amount_paid ?? 0);
  const [updatedOn, setUpdatedOn] = useState(today());

  const setProductField = (idx, key, val) =>
    setProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      let attachment_url;
      if (newFile) {
        attachment_url = await uploadMediaFile(newFile, 'contracts', supplyChainId);
      }
      await updateGroup.mutateAsync({
        contractCode: contract.contract_code,
        products,
        advance_amount_paid: advanceAmountPaid,
        attachment_url,
        updated_at: updatedOn,
      });
      toast({ title: t('contractDetail.updated') });
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('contractDetail.updateFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto" data-testid="update-contract-modal">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('contractDetail.updateContract')}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 mb-2">
          <DetailField label={t('contracts.year')} value={contract.year} testId="update-contract-year" />
          <DetailField label={t('contractWizard.supplier')} value={contract.actors?.contact_name} testId="update-contract-actor" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#7089b4]">{t('contracts.standard')}</span>
            <StandardBadge standard={contract.standard} />
          </div>
        </div>

        {products.map((row, idx) => (
          <div key={row.id} className="flex flex-col gap-2 border-t border-[#cfd8e6] pt-3 mt-2" data-testid={`update-contract-row-${idx}`}>
            <p className="font-bold text-[#032b71]">{row.product}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <RequiredLabel required>{t('contractDetail.expectedQuantityKg')}</RequiredLabel>
                <Input
                  type="number" min="0"
                  data-testid={`update-contract-qty-${idx}`}
                  value={row.expected_quantity}
                  onChange={(e) => setProductField(idx, 'expected_quantity', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel required>{t('contractDetail.maximumPricePerKg')}</RequiredLabel>
                <Input
                  type="number" min="0"
                  data-testid={`update-contract-price-${idx}`}
                  value={row.price}
                  onChange={(e) => setProductField(idx, 'price', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5 border-t border-[#cfd8e6] pt-3 mt-2">
          <RequiredLabel required={false}>{t('contractWizard.uploadContract')}</RequiredLabel>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa] shrink-0" onClick={() => fileInputRef.current?.click()}>
              {t('contractWizard.uploadFile')}
            </Button>
            <span className="text-sm text-[#7089b4] truncate">{newFile?.name || t('forms.noFileChosen')}</span>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('contractWizard.advanceAmountPaid')}</RequiredLabel>
            <Input
              type="number" min="0"
              data-testid="update-contract-advance"
              value={advanceAmountPaid}
              onChange={(e) => setAdvanceAmountPaid(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('contractDetail.updatedOn')}</RequiredLabel>
            <Input
              type="date"
              data-testid="update-contract-updated-on"
              value={updatedOn}
              onChange={(e) => setUpdatedOn(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" data-testid="update-contract-submit" disabled={saving} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
            {saving ? t('forms.saving') : t('contractDetail.updateContract')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractDetail() {
  const { t } = useTranslation();
  const { id: contractCode } = useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(contractCode);
  const [updateOpen, setUpdateOpen] = useState(false);

  if (isLoading || !contract) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }

  const products = Array.isArray(contract.products) ? contract.products : [];

  return (
    <AppLayout hideDefaultHeader>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('contractDetail.title')}</h1>
        <div className="flex items-center gap-3">
          {contract.updated_at && (
            <span className="text-xs italic text-[#7089b4]" data-testid="contract-last-updated">
              {t('contractDetail.lastUpdatedOn')}: {String(contract.updated_at).slice(0, 10)}
            </span>
          )}
          <Button
            data-testid="update-contract-button"
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            onClick={() => setUpdateOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-1" /> {t('contractDetail.updateContract')}
          </Button>
        </div>
      </div>

      {/* 3-column header grid matching the audit exactly: Contract Id/Year/
          Contract type, then Name of Supplier/Country/Signature date, then
          Standard/Advance amount paid/Advance(%), then Comments full width. */}
      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="contract-detail-header">
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          <DetailField label={t('contractDetail.contractId')} value={contract.contract_code} />
          <DetailField label={t('contracts.year')} value={contract.year} />
          <DetailField label={t('contracts.type')} value={contract.contract_type} />

          <DetailField label={t('contractWizard.supplier')} value={contract.actors?.contact_name || t('contractDetail.noSupplier')} />
          <DetailField label={t('contracts.country')} value={contract.actors?.country} />
          <DetailField label={t('contracts.signatureDate')} value={contract.signature_date} />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#7089b4]">{t('contracts.standard')}</span>
            <StandardBadge standard={contract.standard} />
          </div>
          <DetailField label={t('contractWizard.advanceAmountPaid')} value={contract.advance_amount_paid != null ? `${contract.advance_amount_paid} ${contract.currency || ''}` : null} />
          <DetailField label={t('contractWizard.advancePercent')} value={contract.advance_percent != null ? `${contract.advance_percent}%` : null} />

          <div className="col-span-3">
            <DetailField label={t('contractWizard.comments')} value={contract.comments || '-'} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6" data-testid="contract-detail-products">
        <h3 className="text-sm font-black text-[#032b71] mb-3">{t('contractWizard.products')}</h3>
        {products.length === 0 ? (
          <p className="text-sm text-[#7089b4]">{t('common.noRecordsFound')}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                  <th className="py-2">{t('contractWizard.product')}</th>
                  <th className="py-2">{t('contractWizard.expectedQuantity')}</th>
                  <th className="py-2">{t('contractDetail.maximumPricePerKg')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, idx) => (
                  <tr key={row.id || idx} className="border-b border-[#f0f0f0] text-[#032b71]">
                    <td className="py-2">{row.product}</td>
                    <td className="py-2">{row.expected_quantity} {row.unit}</td>
                    <td className="py-2">{row.price != null ? `${row.price} ${contract.currency || ''}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-4 bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-4 mt-4" data-testid="contract-detail-totals">
              <DetailField label={t('contractWizard.totalQuantityExpected')} value={contract.total_quantity_expected} />
              <DetailField label={t('contractWizard.totalContractAmount')} value={products.reduce((s, p) => s + (Number(p.expected_quantity) || 0) * (Number(p.price) || 0), 0).toLocaleString()} />
              <DetailField
                label={t('contractWizard.percentageYellowWax')}
                value={(() => {
                  const total = contract.total_quantity_expected || 0;
                  const yellow = products.filter((p) => p.product === 'Beeswax-Yellow').reduce((s, p) => s + (Number(p.expected_quantity) || 0), 0);
                  return total > 0 ? Math.round((yellow / total) * 100) : '—';
                })()}
              />
            </div>
          </>
        )}

        <div className="mt-4">
          <span className="text-xs text-[#7089b4]">{t('contractWizard.attachedFile')}</span>
          <p className="text-sm text-[#032b71]">
            {contract.attachment_url
              ? <a href={contract.attachment_url} target="_blank" rel="noreferrer" className="text-[#0f48aa] underline">{t('contractWizard.attachedFile')}</a>
              : t('contractWizard.noAttachedFiles')}
          </p>
        </div>
      </div>

      <UpdateContractModal open={updateOpen} onOpenChange={setUpdateOpen} contract={contract} />
    </AppLayout>
  );
}
