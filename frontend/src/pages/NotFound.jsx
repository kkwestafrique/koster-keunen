import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

// Real bug found via independent audit (BUG-42): "Unknown routes
// redirect silently to the dashboard; there is no 404 page." Someone
// following a broken or mistyped link had no way to tell they'd
// actually hit an error -- they'd just land on the Dashboard with no
// explanation at all, which reads as either a very strange navigation
// bug or the wrong destination entirely, not "the page you wanted
// doesn't exist."
export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <AppLayout hideDefaultHeader>
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center" data-testid="not-found-page">
        <h1 className="text-4xl font-black text-[#0f48aa]">404</h1>
        <p className="text-base font-bold text-[#032b71]">{t('notFound.title')}</p>
        <p className="text-sm text-[#7089b4] max-w-sm">{t('notFound.description')}</p>
        <Button
          className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] mt-2"
          onClick={() => navigate('/')}
          data-testid="not-found-go-home"
        >
          {t('notFound.goToDashboard')}
        </Button>
      </div>
    </AppLayout>
  );
}
