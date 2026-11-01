create extension if not exists pgcrypto;

create table if not exists public.donor_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  district text not null check (char_length(district) between 1 and 40),
  area text not null check (char_length(area) between 1 and 60),
  available boolean not null default true,
  public_listing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donor_private (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null check (char_length(phone) between 7 and 25),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  blood_group text not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  units smallint not null check (units between 1 and 3),
  district text not null check (char_length(district) between 1 and 40),
  area text not null check (char_length(area) between 1 and 80),
  needed_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  donor_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (requester_id <> donor_id)
);

create unique index if not exists contact_requests_one_open_pair_idx
  on public.contact_requests (requester_id, donor_id)
  where status in ('pending', 'accepted');
create index if not exists donor_profiles_search_idx
  on public.donor_profiles (blood_group, district, available)
  where public_listing = true;
create index if not exists blood_requests_search_idx
  on public.blood_requests (blood_group, district, needed_at)
  where status = 'active';
create index if not exists contact_requests_donor_idx
  on public.contact_requests (donor_id, status, created_at desc);
create index if not exists contact_requests_requester_idx
  on public.contact_requests (requester_id, status, created_at desc);

alter table public.donor_profiles enable row level security;
alter table public.donor_private enable row level security;
alter table public.blood_requests enable row level security;
alter table public.contact_requests enable row level security;

drop policy if exists "Public can find consented donor profiles" on public.donor_profiles;
create policy "Public can find consented donor profiles"
  on public.donor_profiles for select to anon, authenticated
  using (public_listing = true or user_id = (select auth.uid()));

drop policy if exists "Donors create their own profile" on public.donor_profiles;
create policy "Donors create their own profile"
  on public.donor_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and public_listing = true);

drop policy if exists "Donors update their own profile" on public.donor_profiles;
create policy "Donors update their own profile"
  on public.donor_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Donors delete their own profile" on public.donor_profiles;
create policy "Donors delete their own profile"
  on public.donor_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Donors manage their private phone" on public.donor_private;
create policy "Donors manage their private phone"
  on public.donor_private for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Requesters can read a donor phone after acceptance" on public.donor_private;
create policy "Requesters can read a donor phone after acceptance"
  on public.donor_private for select to authenticated
  using (
    exists (
      select 1
      from public.contact_requests as contact
      where contact.donor_id = donor_private.user_id
        and contact.requester_id = (select auth.uid())
        and contact.status = 'accepted'
        and exists (
          select 1
          from public.donor_profiles as donor
          where donor.user_id = donor_private.user_id
            and donor.public_listing = true
        )
    )
  );

drop policy if exists "Anyone can read active blood requests" on public.blood_requests;
create policy "Anyone can read active blood requests"
  on public.blood_requests for select to anon, authenticated
  using (
    (status = 'active' and needed_at > now())
    or requester_id = (select auth.uid())
  );

drop policy if exists "Signed-in users create their own blood requests" on public.blood_requests;
create policy "Signed-in users create their own blood requests"
  on public.blood_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'active' and needed_at > now());

drop policy if exists "Requesters update their own blood request status" on public.blood_requests;
create policy "Requesters update their own blood request status"
  on public.blood_requests for update to authenticated
  using (requester_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()));

drop policy if exists "Requesters delete their own blood requests" on public.blood_requests;
create policy "Requesters delete their own blood requests"
  on public.blood_requests for delete to authenticated
  using (requester_id = (select auth.uid()));

drop policy if exists "Users read their incoming or outgoing contact requests" on public.contact_requests;
create policy "Users read their incoming or outgoing contact requests"
  on public.contact_requests for select to authenticated
  using (requester_id = (select auth.uid()) or donor_id = (select auth.uid()));

drop policy if exists "Users ask consent from a listed donor" on public.contact_requests;
create policy "Users ask consent from a listed donor"
  on public.contact_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and exists (
      select 1
      from public.donor_profiles as donor
      where donor.user_id = contact_requests.donor_id
        and donor.public_listing = true
        and donor.available = true
    )
  );

drop policy if exists "Donors accept or decline their own requests" on public.contact_requests;
create policy "Donors accept or decline their own requests"
  on public.contact_requests for update to authenticated
  using (donor_id = (select auth.uid()) and status = 'pending')
  with check (donor_id = (select auth.uid()) and status in ('accepted', 'declined'));

revoke all on public.donor_profiles, public.donor_private, public.blood_requests, public.contact_requests from anon, authenticated;
grant select on public.donor_profiles, public.blood_requests to anon, authenticated;
grant insert, update, delete on public.donor_profiles to authenticated;
grant select, insert, update, delete on public.donor_private to authenticated;
grant insert, update, delete on public.blood_requests to authenticated;
grant select, insert on public.contact_requests to authenticated;
grant update (status) on public.contact_requests to authenticated;
grant update (status) on public.blood_requests to authenticated;
