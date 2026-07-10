import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { UploadCloud } from 'lucide-react';

export default function BulkUploads() {
  const { t } = useTranslation();

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.bulkUploads')}</h1>

      <div
        className="bg-white border border-dashed border-[#cfd8e6] rounded-[5px] p-16 flex flex-col items-center justify-center gap-3 text-center"
        data-testid="bulk-uploads-dropzone"
      >
        <UploadCloud className="h-10 w-10 text-[#7089b4]" />
        <p className="text-sm text-[#032b71] font-medium">Drag and drop a file here, or click to browse</p>
        <p className="text-xs text-[#7089b4]">Supports .xlsx and .csv</p>
        <Button className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] mt-2">Choose file</Button>
      </div>
    </AppLayout>
  );
}
