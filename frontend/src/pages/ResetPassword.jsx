import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, KeyRound, Link2Off, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Matches the live-site audit screenshots (Reset_password.jpg / Expired.jpg).
// Supabase's password-recovery email link lands here with a recovery token
// in the URL hash; the client (detectSessionInUrl: true) turns that into a
// real session automatically. If that session isn't present — link already
// used, or expired — we show the "link expired" state instead of a form
// that would just fail on submit.
export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setValidLink(!!data.session);
        setChecking(false);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidLink(true);
        setChecking(false);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const hasEightLetters = password.length >= 8;
  const hasNumeral = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const rulesMet = hasEightLetters && hasNumeral && hasSymbol;
  const passwordsMatch = password && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordsMatch) {
      setError(t('resetPassword.passwordsDontMatch'));
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      toast({ title: t('resetPassword.title') });
      navigate('/login');
    } catch (err) {
      setError(err.message || t('resetPassword.resetFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafc] text-[#7089b4]" data-testid="reset-password-checking">
        {t('common.loading')}
      </div>
    );
  }

  if (!validLink) {
    return (
      <div className="min-h-screen flex flex-col" data-testid="reset-password-expired">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-[#032b71] font-bold text-base tracking-wide">Koster Keunen</h2>
          <span className="text-sm text-[#032b71]">
            {t('forgotPassword.havingTrouble')} <a href="mailto:support@miskkwa.com" className="font-bold hover:underline">{t('forgotPassword.getHelp')}</a>
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 -mt-16">
          <Link2Off className="h-24 w-24 text-[#5b9bf5]" strokeWidth={1.25} />
          <h1 className="text-[24px] font-bold text-[#0f48aa]" data-testid="reset-password-expired-title">
            {t('resetPassword.linkExpiredTitle')}
          </h1>
          <p className="text-sm text-[#032b71]">
            {t('resetPassword.tryAgain')}{' '}
            <Link to="/login" className="font-bold hover:underline">{t('resetPassword.login')}</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" data-testid="reset-password-page">
      <div className="hidden md:flex md:w-1/2 flex-col bg-[#0f48aa] relative overflow-hidden">
        <div className="px-12 pt-12 pb-6">
          <h2 className="text-white font-bold text-base tracking-wide">Koster Keunen</h2>
        </div>
        <h1 className="px-12 text-white text-[28px] font-bold">{t('resetPassword.title')}</h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <Lock className="h-40 w-40 text-[#5b9bf5]" strokeWidth={1.25} />
            <KeyRound className="h-16 w-16 text-[#a9cdfb] absolute -bottom-4 -left-8 rotate-[-35deg]" strokeWidth={1.25} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 bg-white flex flex-col">
        <div className="flex items-center justify-end px-6 py-4">
          <span className="text-sm text-[#032b71]">
            {t('forgotPassword.havingTrouble')} <a href="mailto:support@miskkwa.com" className="font-bold hover:underline">{t('forgotPassword.getHelp')}</a>
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center px-12 md:px-20">
          <div className="w-full max-w-[400px]">
            <h2 className="text-[32px] font-bold text-[#0f48aa] leading-tight mb-4">{t('resetPassword.title')}</h2>
            <p className="text-sm text-[#032b71] mb-8">{t('resetPassword.instructions')}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" data-testid="reset-password-form">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password" className="text-[#7089b4] text-sm font-medium">{t('resetPassword.enterPassword')}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    data-testid="reset-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-[#cfd8e6] focus-visible:ring-[#0f48aa] text-[#032b71] pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7089b4]">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs mt-1">
                  <span className={hasEightLetters ? 'text-[#219653] font-medium' : 'text-[#7089b4]'}>✓ {t('resetPassword.ruleLetters')}</span>
                  <span className={hasNumeral ? 'text-[#219653] font-medium' : 'text-[#7089b4]'}>✓ {t('resetPassword.ruleNumericals')}</span>
                  <span className={hasSymbol ? 'text-[#219653] font-medium' : 'text-[#7089b4]'}>✓ {t('resetPassword.ruleSymbols')}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password" className="text-[#7089b4] text-sm font-medium">{t('resetPassword.reenterPassword')}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    data-testid="reset-password-confirm-input"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 border-[#cfd8e6] focus-visible:ring-[#0f48aa] text-[#032b71] pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7089b4]">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-[#ba550c]" data-testid="reset-password-error">{error}</p>
              )}

              <Button
                type="submit"
                data-testid="reset-password-submit"
                disabled={saving || !rulesMet || !passwordsMatch}
                className="h-12 bg-[#0f48aa] hover:bg-[#0d3d91] text-white text-base font-semibold mt-2 rounded-[5px]"
              >
                {saving ? t('resetPassword.saving') : t('resetPassword.continue')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
