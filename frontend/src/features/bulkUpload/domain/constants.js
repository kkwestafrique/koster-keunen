// Key stamped onto each parsed row to remember its true position in the source
// sheet (survives blank-row filtering). Shared by the reader, the header
// helpers, and the validator -- previously a magic string repeated in all three.
export const ORIGINAL_ROW_INDEX_KEY = '__originalRowIndex';
