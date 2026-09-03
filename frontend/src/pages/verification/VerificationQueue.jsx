import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePendingClaims, useVerifyClaim, useRejectClaim } from '@/hooks/useClaims';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDate } from '@/lib/dateFormat';

// Gap 12: the queue a verifier actually works from. Verify/Reject are
// Admin/Member only (enforced server-side too, not just hidden here), and
// nobody can verify a claim they submitted themselves.
export default function VerificationQueue() {
  const { t } = useTranslation();
  usePageTitle(t('verification.title'));
  const { toast } = useToast();
  const { canApprove } = usePermissions();
  const { data: claims = [], isLoading } = usePendingClaims();
  const verifyClaim = useVerifyClaim();
  const rejectClaim = useRejectClaim();

  const [rejectingClaim, setRejectingClaim] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const handleVerify = async (claimId) => {
    setBusy(true);
    try {
      await verifyClaim.mutateAsync(claimId);
      toast({ title: t('verification.claimVerified') });
    } catch (err) {
      toast({ title: t('verification.verifyFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await rejectClaim.mutateAsync({ claimId: rejectingClaim.id, reason: rejectReason });
      toast({ title: t('verification.claimRejected') });
      setRejectingClaim(null);
      setRejectReason('');
    } catch (err) {
      toast({ title: t('verification.rejectFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'entity_type', label: t('verification.entityType') },
    { key: 'standard', label: t('verification.standard'), render: (row) => <StandardBadge standard={row.standard} /> },
    { key: 'evidence_note', label: t('verification.evidence'), render: (row) => row.evidence_note || '—' },
    {
      key: 'submitted_at',
      label: t('verification.submittedOn'),
      render: (row) => (row.submitted_at ? formatDate(row.submitted_at) : '—'),
    },
    ...(canApprove
      ? [{
          key: '__actions',
          label: '',
          render: (row) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                data-testid={`claim-verify-${row.id}`}
                disabled={busy}
                onClick={() => handleVerify(row.id)}
                className="bg-[#219653] text-white hover:bg-[#1c7f47]"
              >
                {t('verification.verify')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid={`claim-reject-${row.id}`}
                disabled={busy}
                onClick={() => { setRejectingClaim(row); setRejectReason(''); }}
                className="border-[#ba550c] text-[#ba550c]"
              >
                {t('verification.reject')}
              </Button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('verification.title')}</h1>
      <p className="text-sm text-[#5a6f9a] mb-5">{t('verification.description')}</p>

      <DataTable
        testId="verification-queue"
        columns={columns}
        rows={claims}
        total={claims.length}
        page={1}
        pageSize={claims.length || 1}
        loading={isLoading}
        emptyMessage={t('verification.noPendingClaims')}
      />

      <Dialog open={!!rejectingClaim} onOpenChange={(open) => !open && setRejectingClaim(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#032b71] font-black">{t('verification.rejectClaim')}</DialogTitle>
            <DialogDescription className="sr-only">{t('verification.rejectClaim')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="claim-reject-reason" className="text-[#5a6f9a]">{t('verification.rejectionReason')}</Label>
            <Textarea
              id="claim-reject-reason"
              data-testid="claim-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('verification.rejectionReasonPlaceholder')}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setRejectingClaim(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              data-testid="claim-reject-confirm"
              disabled={busy}
              onClick={handleReject}
              className="bg-[#ba550c] text-white hover:bg-[#a34a0a]"
            >
              {busy ? t('forms.saving') : t('verification.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
