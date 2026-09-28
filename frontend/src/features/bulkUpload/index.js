// Public API of the bulk-upload feature. Consumers import from here (or from the
// legacy '@/hooks/useBulkUpload' shim) -- never from the internal layers, so the
// internals can keep being reorganised without touching any page.
export { BULK_UPLOAD_TEMPLATES } from './domain/templates';
export { downloadTemplate } from './infrastructure/templateBuilder';
export { useBulkUpload } from './hooks/useBulkUpload';
