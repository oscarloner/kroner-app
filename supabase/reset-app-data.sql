begin;

truncate table public.transaction_links restart identity cascade;
truncate table public.bank_transactions restart identity cascade;
truncate table public.bank_import_batches restart identity cascade;
truncate table public.bank_learning_examples restart identity cascade;
truncate table public.bank_known_rules restart identity cascade;
truncate table public.entries restart identity cascade;
truncate table public.recurring_items restart identity cascade;
truncate table public.workspaces restart identity cascade;

commit;
