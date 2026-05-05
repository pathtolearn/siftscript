-- ─── Profiles ─────────────────────────────────────────────────────────────────

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── Usage ────────────────────────────────────────────────────────────────────

create table usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month text not null,
  ai_calls int not null default 0,
  cross_video_calls int not null default 0,
  transcripts_saved int not null default 0,
  unique (user_id, month)
);

alter table usage enable row level security;

create policy "Users can view own usage"
  on usage for select
  using (auth.uid() = user_id);

-- ─── Tier limits ──────────────────────────────────────────────────────────────

create table tier_limits (
  tier text primary key,
  max_transcripts int,
  ai_calls_per_month int,
  cross_video_per_month int
);

-- Seed
insert into tier_limits (tier, max_transcripts, ai_calls_per_month, cross_video_per_month) values
  ('free', 30, 10, 2),
  ('pro',  null, null, null);

-- ─── Atomic usage increment ───────────────────────────────────────────────────

create or replace function increment_usage(
  p_user_id uuid,
  p_month text,
  p_field text
) returns void language plpgsql security definer as $$
begin
  -- Ensure row exists for this user/month
  insert into usage (user_id, month, ai_calls, cross_video_calls, transcripts_saved)
  values (p_user_id, p_month, 0, 0, 0)
  on conflict (user_id, month) do nothing;

  -- Atomic increment of the named field
  execute format(
    'update usage set %I = %I + 1 where user_id = $1 and month = $2',
    p_field, p_field
  ) using p_user_id, p_month;
end;
$$;
