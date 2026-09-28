// Compatibility shim. The implementation now lives in the bulk-upload feature
// module (src/features/bulkUpload); this file keeps the original import path
// working for existing consumers so the refactor changes zero call sites.
export { BULK_UPLOAD_TEMPLATES, downloadTemplate, useBulkUpload } from '@/features/bulkUpload';
