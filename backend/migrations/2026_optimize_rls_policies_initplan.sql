-- RLS performance optimization: wrap session-constant helper calls in
-- (select ...), and short-circuit auth_owns_linked_transaction.
--
-- PREPARED FOR REVIEW -- NOT YET APPLIED to the live database. Every
-- statement below was first applied to and verified on a disposable test
-- project (schema-cloned from this live database), seeded with 20,000
-- realistic transactions, 4,000 beekeepers, 60 actors.
--
-- == The real problem, proven empirically ==
--
-- auth_supply_chain_id(), auth_current_actor_id(), auth_role(), and
-- auth_acting_actor_disabled() all take zero arguments -- each depends only
-- on auth.uid(), which is constant for the whole query. But called bare
-- inside an RLS policy, Postgres re-evaluates each one for EVERY ROW the
-- policy filters, not once per query. auth.uid() itself has the same
-- property and the same fix (this is Supabase's own documented guidance:
-- "always use (select auth.uid()) instead of auth.uid()").
--
-- Measured directly, in isolation, calling auth_supply_chain_id() 20,000
-- times:
--   bare:                431ms
--   wrapped (select ...): 16ms   (27x)
--
-- Wrapping forces Postgres to recognize the call as uncorrelated with the
-- outer row and hoist it into a once-per-query InitPlan instead of
-- re-running it per row -- confirmed directly in the query plan itself
-- ("Parent Relationship": "InitPlan").
--
-- Applied to the real transactions_select policy and re-measured the exact
-- paginated query TransactionsList.jsx uses (same 20,000-row test data,
-- same test user, before/after on the identical query):
--   original policy: 1,337ms
--   fixed policy:       460ms   (66% reduction)
--
-- A second, separate, smaller fix is included only for transactions_select:
-- auth_owns_linked_transaction(linked_transaction_group_id) takes a
-- row-varying argument, so it can't be hoisted the same way -- but
-- linked_transaction_group_id is null for the overwhelming majority of real
-- rows (confirmed: 0 of 20,000 seeded rows had it set), so a short-circuit
-- (linked_transaction_group_id IS NOT NULL AND auth_owns_linked_transaction(...))
-- skips the function call entirely in the common case.
--
-- == Scope ==
--
-- 66 of this database's 70 real RLS policies contain at least one bare
-- call to one of these helpers and are rewritten below. The remaining 4
-- (constants_read_all, regions_read_all, transactions_delete,
-- transactions_update) use only `true`/`false` with no function call to
-- optimize, and are correctly left untouched.
--
-- == Verified before being written here ==
--
-- - All 66 statements applied cleanly to the test project (zero syntax
--   errors) in one migration.
-- - Real tenant-isolation check after applying: created a second,
--   independent tenant (its own supply_chain, its own user) and confirmed
--   it sees zero of the first tenant's 20,000 transactions -- RLS
--   correctness is intact, not just RLS speed.
-- - Policy count before and after: 70 = 70.
--
-- == What this migration does NOT change ==
--
-- No access-control logic changes. Every USING/WITH CHECK condition is
-- semantically identical to what it replaces -- same roles, same
-- conditions, same results for every real query -- wrapped differently so
-- Postgres evaluates it more efficiently. This is a performance rewrite,
-- not a permissions change.
DROP POLICY actor_types_select ON public.actor_types;
CREATE POLICY actor_types_select ON public.actor_types FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY actor_types_write ON public.actor_types;
CREATE POLICY actor_types_write ON public.actor_types FOR ALL TO public USING (((select auth_role()) = 'Admin'::text)) WITH CHECK (((select auth_role()) = 'Admin'::text));
DROP POLICY actors_delete ON public.actors;
CREATE POLICY actors_delete ON public.actors FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY actors_insert ON public.actors;
CREATE POLICY actors_insert ON public.actors FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY actors_select ON public.actors;
CREATE POLICY actors_select ON public.actors FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND (((select auth_role()) = 'Admin'::text) OR (id = (select auth_current_actor_id())) OR (EXISTS ( SELECT 1
   FROM connections c
  WHERE ((c.status = 'Active'::text) AND (((c.actor_from_id = (select auth_current_actor_id())) AND (c.actor_to_id = actors.id)) OR ((c.actor_to_id = (select auth_current_actor_id())) AND (c.actor_from_id = actors.id)))))))) OR has_permission(supply_chain_id, 'actors'::text, 'View'::text)));
DROP POLICY actors_update ON public.actors;
CREATE POLICY actors_update ON public.actors FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY beekeeper_yearly_records_delete ON public.beekeeper_yearly_records;
CREATE POLICY beekeeper_yearly_records_delete ON public.beekeeper_yearly_records FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (beekeeper_id IN ( SELECT beekeepers.id
   FROM beekeepers
  WHERE (beekeepers.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY beekeeper_yearly_records_insert ON public.beekeeper_yearly_records;
CREATE POLICY beekeeper_yearly_records_insert ON public.beekeeper_yearly_records FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (beekeeper_id IN ( SELECT beekeepers.id
   FROM beekeepers
  WHERE (beekeepers.supply_chain_id = (select auth_supply_chain_id()))))));
DROP POLICY beekeeper_yearly_records_select ON public.beekeeper_yearly_records;
CREATE POLICY beekeeper_yearly_records_select ON public.beekeeper_yearly_records FOR SELECT TO public USING ((beekeeper_id IN ( SELECT beekeepers.id
   FROM beekeepers
  WHERE (beekeepers.supply_chain_id = (select auth_supply_chain_id())))));
DROP POLICY beekeeper_yearly_records_update ON public.beekeeper_yearly_records;
CREATE POLICY beekeeper_yearly_records_update ON public.beekeeper_yearly_records FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (beekeeper_id IN ( SELECT beekeepers.id
   FROM beekeepers
  WHERE (beekeepers.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (beekeeper_id IN ( SELECT beekeepers.id
   FROM beekeepers
  WHERE (beekeepers.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY beekeepers_delete ON public.beekeepers;
CREATE POLICY beekeepers_delete ON public.beekeepers FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'beekeepers'::text, 'Manage'::text))));
DROP POLICY beekeepers_insert ON public.beekeepers;
CREATE POLICY beekeepers_insert ON public.beekeepers FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND (actor_id = (select auth_current_actor_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))) OR has_permission(supply_chain_id, 'beekeepers'::text, 'Edit'::text))));
DROP POLICY beekeepers_select ON public.beekeepers;
CREATE POLICY beekeepers_select ON public.beekeepers FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND ((actor_id = (select auth_current_actor_id())) OR ((actor_id IS NULL) AND ((select auth_role()) = 'Admin'::text)))) OR has_permission(supply_chain_id, 'beekeepers'::text, 'View'::text)));
DROP POLICY beekeepers_update ON public.beekeepers;
CREATE POLICY beekeepers_update ON public.beekeepers FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'beekeepers'::text, 'Edit'::text)))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'beekeepers'::text, 'Edit'::text))));
DROP POLICY bulk_uploads_delete ON public.bulk_uploads;
CREATE POLICY bulk_uploads_delete ON public.bulk_uploads FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY bulk_uploads_insert ON public.bulk_uploads;
CREATE POLICY bulk_uploads_insert ON public.bulk_uploads FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id()))));
DROP POLICY bulk_uploads_select ON public.bulk_uploads;
CREATE POLICY bulk_uploads_select ON public.bulk_uploads FOR SELECT TO public USING ((supply_chain_id = (select auth_supply_chain_id())));
DROP POLICY bulk_uploads_update ON public.bulk_uploads;
CREATE POLICY bulk_uploads_update ON public.bulk_uploads FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY claims_insert ON public.claims;
CREATE POLICY claims_insert ON public.claims FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id()))));
DROP POLICY claims_select ON public.claims;
CREATE POLICY claims_select ON public.claims FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (deleted_at IS NULL)));
DROP POLICY claims_update ON public.claims;
CREATE POLICY claims_update ON public.claims FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY connections_insert ON public.connections;
CREATE POLICY connections_insert ON public.connections FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id()))));
DROP POLICY connections_select ON public.connections;
CREATE POLICY connections_select ON public.connections FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (deleted_at IS NULL)));
DROP POLICY connections_update ON public.connections;
CREATE POLICY connections_update ON public.connections FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY contract_delivery_notifications_delete ON public.contract_delivery_notifications;
CREATE POLICY contract_delivery_notifications_delete ON public.contract_delivery_notifications FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY contract_delivery_notifications_insert ON public.contract_delivery_notifications;
CREATE POLICY contract_delivery_notifications_insert ON public.contract_delivery_notifications FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (EXISTS ( SELECT 1
   FROM contracts c
  WHERE ((c.contract_group_id = contract_delivery_notifications.contract_group_id) AND (c.owning_actor_id = (select auth_current_actor_id())))))));
DROP POLICY contract_delivery_notifications_select ON public.contract_delivery_notifications;
CREATE POLICY contract_delivery_notifications_select ON public.contract_delivery_notifications FOR SELECT TO public USING ((supply_chain_id = (select auth_supply_chain_id())));
DROP POLICY contract_delivery_notifications_update ON public.contract_delivery_notifications;
CREATE POLICY contract_delivery_notifications_update ON public.contract_delivery_notifications FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY contracts_delete ON public.contracts;
CREATE POLICY contracts_delete ON public.contracts FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (owning_actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'contracts'::text, 'Manage'::text))));
DROP POLICY contracts_insert ON public.contracts;
CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((owning_actor_id = (select auth_current_actor_id())) OR (owning_actor_id IS NULL)) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))) OR has_permission(supply_chain_id, 'contracts'::text, 'Edit'::text))));
DROP POLICY contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND ((owning_actor_id = (select auth_current_actor_id())) OR ((owning_actor_id IS NULL) AND ((select auth_role()) = 'Admin'::text)) OR (actor_id = (select auth_current_actor_id())))) OR has_permission(supply_chain_id, 'contracts'::text, 'View'::text)));
DROP POLICY contracts_update ON public.contracts;
CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (owning_actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'contracts'::text, 'Edit'::text)))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])) AND (owning_actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'contracts'::text, 'Edit'::text))));
DROP POLICY countries_select ON public.countries;
CREATE POLICY countries_select ON public.countries FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY countries_write ON public.countries;
CREATE POLICY countries_write ON public.countries FOR ALL TO public USING (((select auth_role()) = 'Admin'::text)) WITH CHECK (((select auth_role()) = 'Admin'::text));
DROP POLICY exchange_rates_insert ON public.exchange_rates;
CREATE POLICY exchange_rates_insert ON public.exchange_rates FOR INSERT TO public WITH CHECK (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY exchange_rates_select ON public.exchange_rates;
CREATE POLICY exchange_rates_select ON public.exchange_rates FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (deleted_at IS NULL)));
DROP POLICY exchange_rates_update ON public.exchange_rates;
CREATE POLICY exchange_rates_update ON public.exchange_rates FOR UPDATE TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY exports_insert ON public.exports;
CREATE POLICY exports_insert ON public.exports FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY exports_select ON public.exports;
CREATE POLICY exports_select ON public.exports FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (deleted_at IS NULL)));
DROP POLICY exports_update ON public.exports;
CREATE POLICY exports_update ON public.exports FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY field_change_log_select ON public.field_change_log;
CREATE POLICY field_change_log_select ON public.field_change_log FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = 'Admin'::text)));
DROP POLICY notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND (actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'actors'::text, 'View'::text)));
DROP POLICY notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (actor_id = (select auth_current_actor_id())))) WITH CHECK (((supply_chain_id = (select auth_supply_chain_id())) AND (actor_id = (select auth_current_actor_id()))));
DROP POLICY permission_grants_insert ON public.permission_grants;
CREATE POLICY permission_grants_insert ON public.permission_grants FOR INSERT TO public WITH CHECK (((grantor_supply_chain_id = (select auth_supply_chain_id())) AND (granted_by_user_id = (select auth.uid())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY permission_grants_select ON public.permission_grants;
CREATE POLICY permission_grants_select ON public.permission_grants FOR SELECT TO public USING (((grantor_supply_chain_id = (select auth_supply_chain_id())) OR (grantee_user_id = (select auth.uid()))));
DROP POLICY permission_grants_update ON public.permission_grants;
CREATE POLICY permission_grants_update ON public.permission_grants FOR UPDATE TO public USING (((grantor_supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((grantor_supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY stocks_delete ON public.stocks;
CREATE POLICY stocks_delete ON public.stocks FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND (owning_actor_id = (select auth_current_actor_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))) OR has_permission(supply_chain_id, 'stocks'::text, 'Manage'::text))));
DROP POLICY stocks_insert ON public.stocks;
CREATE POLICY stocks_insert ON public.stocks FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND ((supply_chain_id = (select auth_supply_chain_id())) OR has_permission(supply_chain_id, 'stocks'::text, 'Edit'::text))));
DROP POLICY stocks_select ON public.stocks;
CREATE POLICY stocks_select ON public.stocks FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND (owning_actor_id = (select auth_current_actor_id()))) OR has_permission(supply_chain_id, 'stocks'::text, 'View'::text)));
DROP POLICY stocks_update ON public.stocks;
CREATE POLICY stocks_update ON public.stocks FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND (owning_actor_id = (select auth_current_actor_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))) OR has_permission(supply_chain_id, 'stocks'::text, 'Edit'::text)))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((supply_chain_id = (select auth_supply_chain_id())) AND (owning_actor_id = (select auth_current_actor_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))) OR has_permission(supply_chain_id, 'stocks'::text, 'Edit'::text))));
DROP POLICY supply_chains_read ON public.supply_chains;
CREATE POLICY supply_chains_read ON public.supply_chains FOR SELECT TO public USING ((id = (select auth_supply_chain_id())));
DROP POLICY team_members_insert ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (actor_id IN ( SELECT actors.id
   FROM actors
  WHERE (actors.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = 'Admin'::text)));
DROP POLICY team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO public USING (((actor_id IN ( SELECT actors.id
   FROM actors
  WHERE (actors.supply_chain_id = (select auth_supply_chain_id())))) AND (deleted_at IS NULL)));
DROP POLICY team_members_update ON public.team_members;
CREATE POLICY team_members_update ON public.team_members FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (actor_id IN ( SELECT actors.id
   FROM actors
  WHERE (actors.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = 'Admin'::text))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (actor_id IN ( SELECT actors.id
   FROM actors
  WHERE (actors.supply_chain_id = (select auth_supply_chain_id())))) AND ((select auth_role()) = 'Admin'::text)));
DROP POLICY traceability_sequences_authenticated ON public.traceability_sequences;
CREATE POLICY traceability_sequences_authenticated ON public.traceability_sequences FOR ALL TO public USING (((select auth.uid()) IS NOT NULL)) WITH CHECK (((select auth.uid()) IS NOT NULL));
DROP POLICY transaction_batch_selections_delete ON public.transaction_batch_selections;
CREATE POLICY transaction_batch_selections_delete ON public.transaction_batch_selections FOR DELETE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY transaction_batch_selections_insert ON public.transaction_batch_selections;
CREATE POLICY transaction_batch_selections_insert ON public.transaction_batch_selections FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id()))));
DROP POLICY transaction_batch_selections_select ON public.transaction_batch_selections;
CREATE POLICY transaction_batch_selections_select ON public.transaction_batch_selections FOR SELECT TO public USING ((supply_chain_id = (select auth_supply_chain_id())));
DROP POLICY transaction_batch_selections_update ON public.transaction_batch_selections;
CREATE POLICY transaction_batch_selections_update ON public.transaction_batch_selections FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY transactions_insert ON public.transactions;
CREATE POLICY transactions_insert ON public.transactions FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (((direction = 'Send'::text) AND (supply_chain_id = (select auth_supply_chain_id())) AND (owning_actor_id = (select auth_current_actor_id())) AND ((select auth_role()) = 'Admin'::text)) OR ((direction <> 'Send'::text) AND (((supply_chain_id = (select auth_supply_chain_id())) AND ((owning_actor_id = (select auth_current_actor_id())) OR (owning_actor_id IS NULL))) OR has_permission(supply_chain_id, 'transactions'::text, 'Edit'::text))))));
DROP POLICY transactions_select ON public.transactions;
CREATE POLICY transactions_select ON public.transactions FOR SELECT TO public USING ((((supply_chain_id = (select auth_supply_chain_id())) AND ((owning_actor_id = (select auth_current_actor_id())) OR ((owning_actor_id IS NULL) AND ((select auth_role()) = 'Admin'::text)) OR (linked_transaction_group_id IS NOT NULL AND auth_owns_linked_transaction(linked_transaction_group_id)))) OR has_permission(supply_chain_id, 'transactions'::text, 'View'::text)));
DROP POLICY user_accounts_self_select ON public.user_accounts;
CREATE POLICY user_accounts_self_select ON public.user_accounts FOR SELECT TO public USING ((id = (select auth.uid())));
DROP POLICY user_accounts_self_update ON public.user_accounts;
CREATE POLICY user_accounts_self_update ON public.user_accounts FOR UPDATE TO public USING ((id = (select auth.uid()))) WITH CHECK (((id = (select auth.uid())) AND (role = ( SELECT user_accounts_1.role
   FROM user_accounts user_accounts_1
  WHERE (user_accounts_1.id = (select auth.uid())))) AND (NOT (current_actor_id IS DISTINCT FROM ( SELECT user_accounts_1.current_actor_id
   FROM user_accounts user_accounts_1
  WHERE (user_accounts_1.id = (select auth.uid())))))));
DROP POLICY villages_insert ON public.villages;
CREATE POLICY villages_insert ON public.villages FOR INSERT TO public WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));
DROP POLICY villages_select ON public.villages;
CREATE POLICY villages_select ON public.villages FOR SELECT TO public USING (((supply_chain_id = (select auth_supply_chain_id())) AND (deleted_at IS NULL)));
DROP POLICY villages_update ON public.villages;
CREATE POLICY villages_update ON public.villages FOR UPDATE TO public USING (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text])))) WITH CHECK (((NOT (select auth_acting_actor_disabled())) AND (supply_chain_id = (select auth_supply_chain_id())) AND ((select auth_role()) = ANY (ARRAY['Admin'::text, 'Member'::text]))));