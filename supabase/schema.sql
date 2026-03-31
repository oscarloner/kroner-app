create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  legacy_id text,
  name text not null,
  color text not null default '#787774',
  created_at timestamptz not null default now(),
  unique (account_id, legacy_id)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  legacy_id text,
  name text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('income', 'expense')),
  cat text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  date date not null,
  link text,
  note text,
  source_type text,
  source_name text,
  source_transaction_id text,
  source_fingerprint text,
  raw_name text,
  payment_type text,
  import_batch_id uuid,
  match_status text,
  created_at timestamptz not null default now(),
  unique (account_id, legacy_id)
);

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  legacy_id text,
  name text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('sub', 'fixed')),
  cat text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  link text,
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  created_at timestamptz not null default now(),
  unique (account_id, legacy_id)
);

alter table public.recurring_items add column if not exists day_of_month integer not null default 1;
update public.recurring_items set day_of_month = 1 where day_of_month is null;

alter table public.entries add column if not exists source_type text;
alter table public.entries add column if not exists source_name text;
alter table public.entries add column if not exists source_transaction_id text;
alter table public.entries add column if not exists source_fingerprint text;
alter table public.entries add column if not exists raw_name text;
alter table public.entries add column if not exists payment_type text;
alter table public.entries add column if not exists import_batch_id uuid;
alter table public.entries add column if not exists match_status text;
alter table public.entries add column if not exists source_workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.entries add column if not exists transaction_kind text;
alter table public.entries add column if not exists reporting_treatment text not null default 'normal';
alter table public.entries add column if not exists recurring_item_id uuid references public.recurring_items(id) on delete set null;

create table if not exists public.bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  provider text not null check (provider in ('nordea_csv')),
  source_name text not null,
  file_name text not null,
  default_workspace_id uuid references public.workspaces(id) on delete set null,
  status text not null default 'parsed' check (status in ('parsed', 'applied', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.bank_import_batches
add column if not exists default_workspace_id uuid references public.workspaces(id) on delete set null;

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bank_import_batches(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  line_number integer not null,
  booking_date date,
  raw_booking_date text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'NOK',
  payment_type text not null,
  sender text,
  receiver text,
  title text,
  name text,
  raw_label text not null,
  normalized_label text not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  source_workspace_id uuid references public.workspaces(id) on delete set null,
  source_fingerprint text not null,
  transaction_kind text not null default 'other',
  confidence_score integer not null default 0,
  classification_source text,
  review_reason text,
  project_workspace_id uuid references public.workspaces(id) on delete set null,
  reporting_treatment text not null default 'normal',
  status text not null default 'pending' check (status in ('pending', 'applied', 'ignored', 'transfer', 'linked')),
  review_group text not null check (review_group in ('new', 'probable_match', 'transfer', 'ignored_candidate')),
  suggested_action text not null check (suggested_action in ('import_new', 'link_existing', 'create_recurring', 'link_recurring', 'ignore', 'mark_transfer')),
  suggested_entry_id uuid references public.entries(id) on delete set null,
  suggested_match_score integer not null default 0,
  selected_action text check (selected_action in ('import_new', 'link_existing', 'create_recurring', 'link_recurring', 'ignore', 'mark_transfer')),
  selected_entry_id uuid references public.entries(id) on delete set null,
  applied_entry_id uuid references public.entries(id) on delete set null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id, line_number)
);

create table if not exists public.bank_learning_examples (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_name text not null default 'nordea_csv',
  raw_label text not null,
  normalized_label text not null,
  payment_type text not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  cat text not null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  source_workspace_id uuid references public.workspaces(id) on delete set null,
  transaction_kind text not null default 'other',
  reporting_treatment text not null default 'normal',
  entry_name text not null,
  usage_count integer not null default 1,
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (account_id, normalized_label, payment_type, entry_type, cat, workspace_id)
);

create table if not exists public.bank_known_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  label text not null,
  normalized_includes text[] not null default '{}'::text[],
  payment_type text,
  entry_type text check (entry_type in ('income', 'expense')),
  transaction_kind text not null default 'other',
  cat text not null default 'Annet',
  workspace_id uuid references public.workspaces(id) on delete set null,
  confidence_score integer not null default 99,
  reporting_treatment text not null default 'normal',
  auto_apply boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  batch_id uuid not null references public.bank_import_batches(id) on delete cascade,
  left_bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  right_bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  link_kind text not null check (link_kind in ('vipps_offset', 'transfer_pair')),
  confidence_score integer not null default 0,
  status text not null default 'suggested' check (status in ('suggested', 'confirmed', 'rejected')),
  net_effect_direction text,
  created_at timestamptz not null default now(),
  unique (batch_id, left_bank_transaction_id, right_bank_transaction_id, link_kind)
);

alter table public.bank_transactions
add column if not exists source_workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.bank_transactions
add column if not exists transaction_kind text not null default 'other';
alter table public.bank_transactions
add column if not exists confidence_score integer not null default 0;
alter table public.bank_transactions
add column if not exists classification_source text;
alter table public.bank_transactions
add column if not exists review_reason text;
alter table public.bank_transactions
add column if not exists project_workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.bank_transactions
add column if not exists reporting_treatment text not null default 'normal';

alter table public.bank_learning_examples
add column if not exists source_workspace_id uuid references public.workspaces(id) on delete set null;
alter table public.bank_learning_examples
add column if not exists transaction_kind text not null default 'other';
alter table public.bank_learning_examples
add column if not exists reporting_treatment text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'entries_import_batch_id_fkey'
  ) then
    alter table public.entries
      add constraint entries_import_batch_id_fkey
      foreign key (import_batch_id) references public.bank_import_batches(id) on delete set null;
  end if;
end
$$;

do $$
begin
  alter table public.bank_transactions
    drop constraint if exists bank_transactions_suggested_action_check;
  alter table public.bank_transactions
    add constraint bank_transactions_suggested_action_check
    check (suggested_action in ('import_new', 'link_existing', 'create_recurring', 'link_recurring', 'ignore', 'mark_transfer'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.bank_transactions
    drop constraint if exists bank_transactions_selected_action_check;
  alter table public.bank_transactions
    add constraint bank_transactions_selected_action_check
    check (selected_action in ('import_new', 'link_existing', 'create_recurring', 'link_recurring', 'ignore', 'mark_transfer'));
exception
  when duplicate_object then null;
end
$$;

create or replace function private.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, 'account')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function private.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.account_members
    where account_id = target_account_id
      and user_id = auth.uid()
  );
$$;

create or replace function private.account_role(target_account_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select role
  from public.account_members
  where account_id = target_account_id
    and user_id = auth.uid()
  limit 1;
$$;

revoke all on function private.slugify(text) from public;
revoke all on function private.is_account_member(uuid) from public;
revoke all on function private.account_role(uuid) from public;
grant execute on function private.is_account_member(uuid) to authenticated;
grant execute on function private.account_role(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  new_account_id uuid;
  base_slug text;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);

  base_slug := private.slugify(split_part(coalesce(new.email, 'account'), '@', 1));

  insert into public.accounts (slug, name, created_by)
  values (
    base_slug || '-' || substring(replace(new.id::text, '-', '') from 1 for 8),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Kroner'), '@', 1)) || ' sitt regnskap',
    new.id
  )
  returning id into new_account_id;

  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.account_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.entries enable row level security;
alter table public.recurring_items enable row level security;
alter table public.bank_import_batches enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.bank_learning_examples enable row level security;
alter table public.bank_known_rules enable row level security;
alter table public.transaction_links enable row level security;

create policy "Users read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Members read accounts"
on public.accounts
for select
using (private.is_account_member(id));

create policy "Owners and admins update accounts"
on public.accounts
for update
using (private.account_role(id) in ('owner', 'admin'))
with check (private.account_role(id) in ('owner', 'admin'));

create policy "Members read account members"
on public.account_members
for select
using (private.is_account_member(account_id));

create policy "Owners and admins insert account members"
on public.account_members
for insert
with check (private.account_role(account_id) in ('owner', 'admin'));

create policy "Owners and admins update account members"
on public.account_members
for update
using (private.account_role(account_id) in ('owner', 'admin'))
with check (private.account_role(account_id) in ('owner', 'admin'));

create policy "Owners and admins delete account members"
on public.account_members
for delete
using (private.account_role(account_id) in ('owner', 'admin'));

create policy "Members read workspaces"
on public.workspaces
for select
using (private.is_account_member(account_id));

create policy "Members manage workspaces"
on public.workspaces
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read entries"
on public.entries
for select
using (private.is_account_member(account_id));

create policy "Members manage entries"
on public.entries
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read recurring items"
on public.recurring_items
for select
using (private.is_account_member(account_id));

create policy "Members manage recurring items"
on public.recurring_items
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read bank import batches"
on public.bank_import_batches
for select
using (private.is_account_member(account_id));

create policy "Members manage bank import batches"
on public.bank_import_batches
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read bank transactions"
on public.bank_transactions
for select
using (private.is_account_member(account_id));

create policy "Members manage bank transactions"
on public.bank_transactions
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read bank learning examples"
on public.bank_learning_examples
for select
using (private.is_account_member(account_id));

create policy "Members manage bank learning examples"
on public.bank_learning_examples
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read known bank rules"
on public.bank_known_rules
for select
using (private.is_account_member(account_id));

create policy "Members manage known bank rules"
on public.bank_known_rules
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));

create policy "Members read transaction links"
on public.transaction_links
for select
using (private.is_account_member(account_id));

create policy "Members manage transaction links"
on public.transaction_links
for all
using (private.is_account_member(account_id))
with check (private.is_account_member(account_id));
