-- 1. AFFILIATE PARTNERS TABLE
create table if not exists public.affiliate_partners (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  payment_info text,
  total_conversions int default 0,
  pending_commission int default 0,
  payout_milestone int default 15,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.affiliate_partners enable row level security;

-- Idempotent Policy Creation
do $$
begin
    drop policy if exists "Public read access" on public.affiliate_partners;
    create policy "Public read access" on public.affiliate_partners for select using (true);
end $$;

-- 2. REFERRAL LOGS TABLE
create table if not exists public.referral_logs (
  id uuid default gen_random_uuid() primary key,
  referee_id uuid references auth.users(id) on delete set null,
  referrer_code text references public.affiliate_partners(code),
  status text check (status in ('registered', 'converted')) default 'registered',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.referral_logs enable row level security;

do $$
begin
    drop policy if exists "Service role write only" on public.referral_logs;
    create policy "Service role write only" on public.referral_logs for all using (auth.role() = 'service_role');
    
    drop policy if exists "Users can insert their own referral" on public.referral_logs;
    create policy "Users can insert their own referral" on public.referral_logs for insert with check (auth.uid() = referee_id);
end $$;

-- 3. PAYOUT QUEUE TABLE
create table if not exists public.payout_queue (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.affiliate_partners(id),
  amount int not null,
  milestone_hit int,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.payout_queue enable row level security;

-- 4. ADD CREDITS RPC (Secure Function)
create or replace function public.add_credits(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set credit_balance = credit_balance + p_amount
  where id = p_user_id;
end;
$$;

-- 5. SEPAY TRANSACTIONS TABLE
create table if not exists public.sepay_transactions (
  id text primary key,
  user_id uuid references auth.users(id),
  amount int not null,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sepay_transactions enable row level security;

do $$
begin
    drop policy if exists "Service role check" on public.sepay_transactions;
    create policy "Service role check" on public.sepay_transactions for all using (auth.role() = 'service_role');
end $$;
