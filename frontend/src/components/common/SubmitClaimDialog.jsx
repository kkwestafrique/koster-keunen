import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { STANDARDS } from '@/data/regions';
import { useSubmitClaim } from '@/hooks/useClaims';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// Gap 12 follow-up: the claims verification workflow (see
// VerificationQueue.jsx / useClaims.js) had an approval half but no
// submission UI -- claims could only be created via direct API calls.
// This is the missing "submit a claim" form. It's deliberately the ONLY
// UI path left that can add a standard, now that beekeepers.standards
// and actors.standards are guarded at the database level (see
// backend/migrations/2026_lock_standards_column_to_claims_workflow.sql)
// to reject any change that didn't come through verify_claim().
//
// currentStandards + pendingStandards are passed in so the picker only
// offers a standard that isn't already held and doesn't already have a
// claim awaiting review -- resubmitting the same thing twice would just
// clutter the verification queue.
export default function SubmitClaimDialog({ entityType, entityId, currentStandards = [], pendingStandards = [], disabled = false, testId }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const submitClaim = useSubmitClaim();

  const [open, setOpen] = useState(false);
  const [standard, setStandard] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const takenOrPending = new Set([...currentStandards, ...pendingStandards]);
  const availableStandards = STANDARDS.filter((s) => !takenOrPending.has(s));

  const resetAndClose = () => {
    setOpen(false);
    setStandard('');
    setEvidenceNote('');
  };

  const handleSubmit = async () => {
    if (!standard) return;
    setSubmitting(true);
    try {
      await submitClaim.mutateAsync({ entityType, entityId, standard, evidenceNote });
      toast({ title: t('verification.claimSubmitted') });
      resetAndClose();
    } catch (err) {
      toast({ title: t('verification.submitFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          data-testid={testId || 'submit-claim-trigger'}
          className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('verification.submitClaim')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('verification.submitClaimTitle')}</DialogTitle>
        </DialogHeader>

        {availableStandards.length === 0 ? (
          <p className="text-sm text-[#5a6f9a]" data-testid="submit-claim-none-available">
            {t('verification.noStandardsAvailable')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#5a6f9a]">{t('verification.selectStandard')}</Label>
              <Select value={standard} onValueChange={setStandard}>
                <SelectTrigger className="bg-white" data-testid="submit-claim-standard">
                  <SelectValue placeholder={t('verification.selectStandardPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {availableStandards.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#5a6f9a]">{t('verification.evidenceNote')}</Label>
              <Textarea
                data-testid="submit-claim-evidence"
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
                placeholder={t('verification.evidenceNotePlaceholder')}
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={resetAndClose}>
            {t('common.cancel')}
          </Button>
          {availableStandards.length > 0 && (
            <Button
              data-testid="submit-claim-confirm"
              disabled={submitting || !standard}
              onClick={handleSubmit}
              className="bg-[#0f48aa] text-white hover:bg-[#0d3c8f]"
            >
              {submitting ? t('forms.saving') : t('verification.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
