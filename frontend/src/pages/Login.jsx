import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="login-language-switcher"
          className="flex items-center gap-1 border border-[#cfd8e6] rounded px-3 py-1.5 text-sm text-[#032b71] hover:bg-[#f5f5f5] transition-colors"
        >
          <span className="text-xs">{current.flag}</span>
          <span>{current.code === 'en' ? 'Eng' : 'Fr'}</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-3 py-1.5 text-xs font-semibold text-[#032b71]">Languages</div>
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            data-testid={`login-language-option-${lang.code}`}
            onClick={() => i18n.changeLanguage(lang.code)}
            className="flex items-center gap-2"
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left panel - Blue branding */}
      <div className="hidden md:flex md:w-1/2 flex-col bg-[#0f48aa] relative overflow-hidden">
        <div className="px-12 pt-12 pb-6">
          <h2 className="text-white font-bold text-base tracking-wide">Koster Keunen</h2>
          <h1 className="text-white text-[28px] font-bold leading-tight mt-6">
            Block chain powered<br />supply chain platform
          </h1>
        </div>
        {/* Decorative 3D cube illustration */}
        <div className="flex-1 relative">
          <svg className="absolute bottom-0 left-0 w-[420px] h-[420px] opacity-90" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Swirl line */}
            <path d="M 50 120 C 30 180, 80 280, 160 320 S 320 360, 350 280" stroke="rgba(120,180,255,0.35)" strokeWidth="3" fill="none" />
            {/* Cube face - top */}
            <path d="M200 140 L300 190 L200 240 L100 190 Z" fill="rgba(100,170,255,0.5)" />
            {/* Cube face - left */}
            <path d="M100 190 L200 240 L200 340 L100 290 Z" fill="rgba(60,130,220,0.6)" />
            {/* Cube face - right */}
            <path d="M200 240 L300 190 L300 290 L200 340 Z" fill="rgba(40,100,200,0.7)" />
            {/* Cube edges */}
            <path d="M200 140 L300 190 L200 240 L100 190 Z M100 190 L100 290 L200 340 L200 240 M200 340 L300 290 L300 190" stroke="rgba(150,200,255,0.6)" strokeWidth="2" fill="none" />
            {/* Small floating triangles */}
            <path d="M280 130 L295 155 L265 155 Z" fill="rgba(100,170,255,0.4)" />
            <path d="M320 250 L335 275 L305 275 Z" fill="rgba(100,170,255,0.3)" />
            <path d="M85 250 L100 275 L70 275 Z" fill="rgba(100,170,255,0.3)" />
          </svg>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="w-full md:w-1/2 bg-white flex flex-col">
        <div className="flex justify-end px-6 py-4">
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex items-center justify-center px-12 md:px-20">
          <div className="w-full max-w-[400px]">
            <h2 className="text-[32px] font-bold text-[#0f48aa] leading-tight mb-2">
              {t('login.title')}<br />{t('login.titleLine2')}
            </h2>
            <p className="text-sm text-[#032b71] mb-8">
              {t('login.welcome')}<br />{t('login.welcomeLine2')}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5" data-testid="login-form">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-[#0f48aa] text-sm font-medium">{t('login.email')}</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Sampleemail@gmail.com"
                  className="h-12 border-[#cfd8e6] focus-visible:ring-[#0f48aa] text-[#032b71]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-[#0f48aa] text-sm font-medium">{t('login.password')}</Label>
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 border-[#cfd8e6] focus-visible:ring-[#0f48aa] text-[#032b71]"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
                  <input type="checkbox" className="rounded border-[#cfd8e6]" />
                  {t('login.keepLoggedIn')}
                </label>
                <button type="button" className="text-sm font-bold text-[#032b71] hover:text-[#0f48aa]">
                  {t('login.forgotPassword')}
                </button>
              </div>

              {error && (
                <p className="text-sm text-[#ba550c]" data-testid="login-error">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                data-testid="login-submit-button"
                disabled={loading}
                className="h-12 bg-[#032b71] hover:bg-[#021d4f] text-white text-base font-semibold mt-2 rounded-[5px]"
              >
                {loading ? t('login.signingIn') : t('login.loginButton')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
