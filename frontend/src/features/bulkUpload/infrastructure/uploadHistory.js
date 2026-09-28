// Persistence of the Bulk Uploads history page's rows. One place owns the payload
// shape (it was assembled by hand in three separate call sites before) and the
// rule that a logging failure must never block the person from seeing their real
// import result.
//
// `client` is injected (any Supabase-shaped client) rather than imported, so this
// stays testable without a network. Resolves true if the write did not throw.
export async function recordBulkUpload(client, { supplyChainId, uploadType, fileName, status, errorDetail, progress = 100, extra = {} }) {
  try {
    await client.from('bulk_uploads').insert({
      supply_chain_id: supplyChainId,
      upload_type: uploadType,
      file_name: fileName,
      status,
      progress,
      error_detail: errorDetail,
      ...extra,
    });
    return true;
  } catch (logErr) {
    console.error('Failed to log bulk upload history:', logErr);
    return false;
  }
}
