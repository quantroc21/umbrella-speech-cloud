-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Linked to auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  credit_balance bigint default 100 check (credit_balance >= 0), -- Free tier starts with 100 chars
  subscription_status text default 'free', -- 'free', 'pro', 'enterprise'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. Cloned Voices Table
create table public.cloned_voices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  voice_name text not null,
  r2_uuid_path text not null, -- e.g. "u-123/v-456/"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.cloned_voices enable row level security;
create policy "Users can view own voices" on cloned_voices for select using (auth.uid() = user_id);
create policy "Users can insert own voices" on cloned_voices for insert with check (auth.uid() = user_id);

-- 3. Secure Transactions Table (Audit Log)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  amount int not null, -- Negative for usage, Positive for refills
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CRITICAL: Atomic Credit Deduction Function
-- This function MUST be called by the API, NOT the client directly.
create or replace function process_audio_request(
  p_user_id uuid,
  p_cost int
) returns boolean as $$
declare
  current_bal bigint;
begin
  -- Lock the row to prevent race conditions
  select credit_balance into current_bal from public.profiles
  where id = p_user_id
  for update;

  if current_bal >= p_cost then
    -- Deduct credits
    update public.profiles
    set credit_balance = credit_balance - p_cost,
        updated_at = now()
    where id = p_user_id;
    
    -- Log transaction
    insert into public.transactions (user_id, amount, description)
    values (p_user_id, -p_cost, 'Audio Generation Usage');
    
    return true; -- Success
  else
    return false; -- Insufficient funds
  end if;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
