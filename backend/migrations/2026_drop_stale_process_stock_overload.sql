-- Fixes: Process Stock cannot submit at all ("Could not choose the best
-- candidate function between: process_stock(...), process_stock(...,
-- p_idempotency_key => uuid)").
--
-- Root cause: when p_idempotency_key was added to process_stock() via
-- CREATE OR REPLACE FUNCTION, Postgres created a NEW overload (a second,
-- 8-argument function) rather than replacing the original 7-argument
-- one, because the signature changed. The old 7-arg version was never
-- dropped. PostgREST's RPC resolution does not reliably support
-- overloaded function names -- having two process_stock() functions in
-- the schema is itself the bug, independent of which arguments any
-- given caller actually sends.
--
-- The frontend (useProcessStock in useTransactions.js) already always
-- calls with all 8 named arguments, including p_idempotency_key
-- (generated once per form mount via crypto.randomUUID(), specifically
-- to prevent a network retry from double-consuming real source stock).
-- The 8-arg version is the only one ever intended to be called; the
-- two function bodies are otherwise identical. Confirmed via pg_depend
-- that nothing else in the schema references the old 7-arg signature.

drop function if exists public.process_stock(
  text, text, jsonb, jsonb, text, date, text
);
