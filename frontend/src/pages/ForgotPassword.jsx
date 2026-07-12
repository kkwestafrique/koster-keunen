import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Lock, KeyRound, Mail } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', label: 'Eng' },
  { code: 'fr', label: 'Fr' },
];

// Matches the live-site audit screenshots (Forgot_password.jpg /
// Forgot_password1.jpg): a two-panel layout — blue branding panel on the
// left with a lock/key illustration, form on the right. Submitting sends a
// real Supabase password-recovery email; redirectTo points at
// /reset-password, which is where Supabase's recovery link lands the person.
export default function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const sendResetEmail = async () => {
    setSending(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err.message || t('forgotPassword.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendResetEmail();
  };

  return (
    <div className="min-h-screen flex" data-testid="forgot-password-page">
      <div className="hidden md:flex md:w-1/2 flex-col bg-[#0f48aa] relative overflow-hidden">
        <div className="px-12 pt-12 pb-6">
          <h2 className="text-white font-bold text-base tracking-wide">Koster Keunen</h2>
        </div>
        <h1 className="px-12 text-white text-[28px] font-bold">{t('forgotPassword.title')}</h1>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            <Lock className="h-40 w-40 text-[#5b9bf5]" strokeWidth={1.25} />
            <KeyRound className="h-16 w-16 text-[#a9cdfb] absolute -bottom-4 -left-8 rotate-[-35deg]" strokeWidth={1.25} />
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 bg-white flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/login" data-testid="forgot-password-back" className="flex items-center gap-1 text-sm font-bold text-[#032b71] hover:text-[#0f48aa]">
            <ChevronLeft className="h-4 w-4" /> {t('forgotPassword.back')}
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#032b71]">
              {t('forgotPassword.havingTrouble')} <a href="mailto:support@miskkwa.com" className="font-bold hover:underline">{t('forgotPassword.getHelp')}</a>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="forgot-password-language-switcher" className="flex items-center gap-1 border border-[#cfd8e6] rounded px-3 py-1.5 text-sm text-[#032b71] hover:bg-[#f5f5f5]">
                  {LANGUAGES.find((l) => l.code === i18n.language)?.label || 'Eng'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LANGUAGES.map((lang) => (
                  <DropdownMenuItem key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}>
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-12 md:px-20">
          <div className="w-full max-w-[400px]">
            {!sent ? (
              <>
                <h2 className="text-[32px] font-bold text-[#0f48aa] leading-tight mb-4">{t('forgotPassword.title')}</h2>
                <p className="text-sm text-[#032b71] mb-8">{t('forgotPassword.instructions')}</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5" data-testid="forgot-password-form">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-[#7089b4] text-sm font-medium">{t('forgotPassword.email')}</Label>
                    <Input
                      id="email"
                      data-testid="forgot-password-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="h-12 border-[#cfd8e6] focus-visible:ring-[#0f48aa] text-[#032b71]"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-[#ba550c]" data-testid="forgot-password-error">{error}</p>
                  )}

                  <Button
                    type="submit"
                    data-testid="forgot-password-submit"
                    disabled={sending}
                    className="h-12 bg-[#0f48aa] hover:bg-[#0d3d91] text-white text-base font-semibold mt-2 rounded-[5px]"
                  >
                    {sending ? t('forgotPassword.sending') : t('forgotPassword.continue')}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center" data-testid="forgot-password-sent">
                <Mail className="h-12 w-12 text-[#0f48aa] mx-auto mb-6" strokeWidth={1.5} />
                <h2 className="text-[24px] font-bold text-[#0f48aa] mb-3">{t('forgotPassword.checkEmailTitle')}</h2>
                <p className="text-sm text-[#032b71] mb-6">
                  {t('forgotPassword.checkEmailBody', { email })}
                </p>
                <p className="text-sm text-[#032b71]">
                  {t('forgotPassword.cantFindIt')}{' '}
                  <button
                    type="button"
                    data-testid="forgot-password-resend"
                    onClick={sendResetEmail}
                    disabled={sending}
                    className="font-bold text-[#0f48aa] hover:underline"
                  >
                    {t('forgotPassword.resendMail')}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
