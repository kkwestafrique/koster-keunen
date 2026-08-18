import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import RequiredLabel from '@/components/common/RequiredLabel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateMyProfile, useChangePassword } from '@/hooks/useMyProfile';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// Gap 3: "My Profile" in the TopBar previously just navigated to the
// COMPANY profile -- there was no page for a person to view or manage
// their own account at all.
export default function UserProfile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const updateProfile = useUpdateMyProfile();
  const changePassword = useChangePassword();

  const [username, setUsername] = useState(profile?.username || '');
  const [language, setLanguage] = useState(
    profile?.language_preference === 'French' ? 'fr' : profile?.language_preference === 'English' ? 'en' : (i18n.language || 'en')
  );
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const dbLanguage = language === 'fr' ? 'French' : 'English';
      await updateProfile.mutateAsync({ id: profile.id, username, language_preference: dbLanguage });
      i18n.changeLanguage(language);
      await refreshProfile();
      toast({ title: t('userProfile.profileSaved') });
    } catch (err) {
      toast({ title: t('userProfile.saveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t('userProfile.passwordTooShort'), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t('userProfile.passwordsDontMatch'), variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword.mutateAsync(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: t('userProfile.passwordChanged') });
    } catch (err) {
      toast({ title: t('userProfile.passwordChangeFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('userProfile.title')}</h1>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-2xl mb-6">
        <h2 className="text-sm font-black text-[#032b71] mb-4">{t('userProfile.accountDetails')}</h2>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <DetailField label={t('userProfile.email')} value={user?.email} testId="profile-email" />
          <DetailField label={t('userProfile.role')} value={profile?.role} testId="profile-role" />
          <DetailField
            label={t('userProfile.memberSince')}
            value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
            testId="profile-member-since"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('userProfile.name')}</RequiredLabel>
            <Input data-testid="profile-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('topbar.languages')}</RequiredLabel>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="profile-language"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('topbar.english')}</SelectItem>
                <SelectItem value="fr">{t('topbar.french')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          data-testid="profile-save"
          disabled={saving || !username}
          onClick={handleSaveProfile}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] mt-5"
        >
          {saving ? t('forms.saving') : t('common.save')}
        </Button>
      </div>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-2xl">
        <h2 className="text-sm font-black text-[#032b71] mb-4">{t('userProfile.changePassword')}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('userProfile.newPassword')}</RequiredLabel>
            <Input
              type="password"
              data-testid="profile-new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('userProfile.confirmPassword')}</RequiredLabel>
            <Input
              type="password"
              data-testid="profile-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <Button
          data-testid="profile-change-password"
          disabled={changingPassword || !newPassword || !confirmPassword}
          onClick={handleChangePassword}
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] mt-5"
        >
          {changingPassword ? t('forms.saving') : t('userProfile.changePassword')}
        </Button>
      </div>
    </AppLayout>
  );
}
