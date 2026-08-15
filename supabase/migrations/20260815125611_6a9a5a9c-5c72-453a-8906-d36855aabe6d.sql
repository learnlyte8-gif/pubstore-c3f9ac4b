create policy "Admins read all commissions" on public.supplier_commissions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all ai ledger" on public.ai_credit_ledger for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all supplier subscriptions" on public.supplier_subscriptions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all campaigns" on public.ad_campaigns for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "Admins read all wallet transactions" on public.wallet_transactions for select to authenticated using (public.has_role(auth.uid(),'admin'));