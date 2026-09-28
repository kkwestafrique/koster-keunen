// Loaded automatically by Create React App before each test file.
//
// src/lib/supabaseClient.js builds a real Supabase client the moment
// it's imported and throws "supabaseUrl is required" if the env vars
// are missing. Several hooks import it, so any test that touches a
// hook -- even one that only exercises a pure function exported from
// it, like aggregateBeekeepers -- failed to load at all.
//
// These are deliberately fake placeholders, not real credentials: the
// client only needs a well-formed URL and a non-empty key to
// construct, and no test makes a network call through it. `||=` means
// a real value in the environment is never overridden.
process.env.REACT_APP_SUPABASE_URL ||= 'http://localhost:54321';
process.env.REACT_APP_SUPABASE_ANON_KEY ||= 'test-anon-key-not-real';
