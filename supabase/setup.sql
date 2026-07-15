-- ERTY Supabase setup
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'technician', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  category_id text primary key,
  label text not null,
  tagline text not null default '',
  booking_fee integer not null default 0,
  coming_soon boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_code text unique not null,
  category text not null references public.service_categories(category_id),
  name text not null,
  description text not null default '',
  icon text not null default 'wrench',
  image_url text not null default '',
  tiers jsonb not null default '[]'::jsonb,
  base_price integer not null default 0,
  market_min integer not null default 0,
  market_max integer not null default 0,
  is_flat_visit boolean not null default false,
  booking_fee integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  picture text not null default '',
  rating numeric not null default 0,
  experience_years integer not null default 0,
  specializations text[] not null default '{}',
  phone text not null default '',
  is_available boolean not null default false,
  home_lat numeric not null default 28.4595,
  home_lng numeric not null default 77.0266,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  gov_id_thumb text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  issue_summary text not null default '',
  detected_problems text[] not null default '{}',
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  estimated_cost_min integer not null default 0,
  estimated_cost_max integer not null default 0,
  recommended_service text not null default '',
  ai_notes text not null default '',
  image_thumb text not null default '',
  language text not null default 'English',
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  category text not null,
  tier_name text not null,
  price integer not null default 0,
  address text not null default '',
  scheduled_date date,
  scheduled_slot text not null default '',
  notes text not null default '',
  status text not null default 'unassigned'
    check (status in ('unassigned', 'assigned', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled')),
  technician_id uuid references public.technicians(id) on delete set null,
  tech_name text,
  tech_picture text,
  tech_lat numeric,
  tech_lng numeric,
  dest_lat numeric not null default 28.4595,
  dest_lng numeric not null default 77.0266,
  diagnosis_id uuid references public.diagnoses(id) on delete set null,
  rating integer check (rating is null or rating between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.custom_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text,
  user_name text,
  description text not null,
  phone text not null default '',
  preferred_date date,
  address text not null default '',
  status text not null default 'pending_manpower_approval'
    check (status in ('pending_manpower_approval', 'approved', 'rejected', 'fulfilled')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  booking_id uuid references public.bookings(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    'customer'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.technicians enable row level security;
alter table public.diagnoses enable row level security;
alter table public.bookings enable row level security;
alter table public.custom_jobs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_self_update_basic" on public.profiles;
create policy "profiles_self_update_basic"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.profiles.role);

drop policy if exists "categories_public_read" on public.service_categories;
create policy "categories_public_read"
on public.service_categories for select
to anon, authenticated
using (true);

drop policy if exists "categories_admin_all" on public.service_categories;
create policy "categories_admin_all"
on public.service_categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "services_public_read" on public.services;
create policy "services_public_read"
on public.services for select
to anon, authenticated
using (active = true);

drop policy if exists "services_admin_all" on public.services;
create policy "services_admin_all"
on public.services for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "technicians_public_read_approved" on public.technicians;
create policy "technicians_public_read_approved"
on public.technicians for select
to anon, authenticated
using (status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy if exists "technicians_user_apply" on public.technicians;
create policy "technicians_user_apply"
on public.technicians for insert
to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "technicians_admin_all" on public.technicians;
create policy "technicians_admin_all"
on public.technicians for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "diagnoses_owner_all" on public.diagnoses;
create policy "diagnoses_owner_all"
on public.diagnoses for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "bookings_owner_or_tech_or_admin_read" on public.bookings;
create policy "bookings_owner_or_tech_or_admin_read"
on public.bookings for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.technicians t
    where t.id = bookings.technician_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "bookings_owner_insert" on public.bookings;
create policy "bookings_owner_insert"
on public.bookings for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "bookings_owner_update" on public.bookings;
create policy "bookings_owner_update"
on public.bookings for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "bookings_assigned_tech_update" on public.bookings;
create policy "bookings_assigned_tech_update"
on public.bookings for update
to authenticated
using (
  exists (
    select 1 from public.technicians t
    where t.id = bookings.technician_id
      and t.user_id = auth.uid()
      and t.status = 'approved'
  )
)
with check (
  exists (
    select 1 from public.technicians t
    where t.id = bookings.technician_id
      and t.user_id = auth.uid()
      and t.status = 'approved'
  )
);

drop policy if exists "bookings_admin_all" on public.bookings;
create policy "bookings_admin_all"
on public.bookings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "custom_jobs_owner_insert" on public.custom_jobs;
create policy "custom_jobs_owner_insert"
on public.custom_jobs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "custom_jobs_owner_read" on public.custom_jobs;
create policy "custom_jobs_owner_read"
on public.custom_jobs for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "custom_jobs_admin_all" on public.custom_jobs;
create policy "custom_jobs_admin_all"
on public.custom_jobs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notifications_owner_read_update" on public.notifications;
create policy "notifications_owner_read_update"
on public.notifications for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

insert into public.service_categories (category_id, label, tagline, booking_fee, coming_soon, sort_order)
values
  ('home_appliances', 'Home Appliances', 'Repair, install, service', 0, false, 1),
  ('handyman', 'Handyman & Odd Jobs', 'Rs 100 booking fee', 100, false, 2),
  ('car_and_bike', 'Car & Bike Repair', 'Doorstep vehicle care', 0, false, 3),
  ('permanent_drivers', 'Permanent Drivers', 'Monthly, full-time', 0, true, 4),
  ('domestic_maids', 'Domestic Maids', 'Verified housekeeping', 0, true, 5)
on conflict (category_id) do update set
  label = excluded.label,
  tagline = excluded.tagline,
  booking_fee = excluded.booking_fee,
  coming_soon = excluded.coming_soon,
  sort_order = excluded.sort_order;

insert into public.services (
  service_code, category, name, description, icon, image_url, tiers,
  base_price, market_min, market_max, is_flat_visit, booking_fee
)
values
  (
    'svc_ro_service', 'home_appliances', 'RO System Service',
    'Filter change, membrane clean, motor and pump check for all RO brands.',
    'droplets', 'https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=600',
    '[{"name":"Basic Service","price":449,"features":["Sediment and carbon filter clean","Water quality check"]},{"name":"Full Service","price":999,"features":["All 4 filters replaced","Membrane wash","6-month warranty"]}]'::jsonb,
    449, 500, 1500, false, 0
  ),
  (
    'svc_chimney_service', 'home_appliances', 'Kitchen Chimney Service',
    'Deep clean, filter degrease, motor and suction diagnostics for chimneys.',
    'cooking-pot', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600',
    '[{"name":"Basic Clean","price":499,"features":["Baffle filter clean","External wipe"]},{"name":"Deep Service","price":1299,"features":["Full dismantle","Motor grease","Baffle degrease"]}]'::jsonb,
    499, 600, 1800, false, 0
  ),
  (
    'svc_ac_repair', 'home_appliances', 'AC Repair',
    'Cooling issues, gas refill, compressor and PCB service.',
    'air-vent', 'https://images.unsplash.com/photo-1631545308456-19a9d5c8b4c8?w=600',
    '[{"name":"Gas Check","price":599,"features":["Pressure test","Filter clean"]},{"name":"Gas Refill","price":1799,"features":["Refill and leak check","3-month warranty"]}]'::jsonb,
    599, 700, 3500, false, 0
  ),
  (
    'svc_washing_machine', 'home_appliances', 'Washing Machine Repair',
    'Drum, motor, drainage, and control fixes for all brands.',
    'washing-machine', 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600',
    '[{"name":"Basic Checkup","price":499,"features":["Diagnostic","Cleaning"]},{"name":"Standard Repair","price":1299,"features":["Small parts and motor check","6-month warranty"]}]'::jsonb,
    499, 600, 2500, false, 0
  ),
  (
    'svc_tv_mounting', 'handyman', 'TV Wall Mounting',
    'Fixed or tilt-mount TVs up to 65 inches. Cable routing included.',
    'tv', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600',
    '[{"name":"Booking Visit","price":249,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    249, 249, 1500, true, 100
  ),
  (
    'svc_fan_install', 'handyman', 'Ceiling Fan Installation',
    'Fan install, replace or rewiring at your ceiling point.',
    'fan', 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600',
    '[{"name":"Booking Visit","price":199,"features":["Rs 100 booking fee to secure the slot","Handyman arrives with tools","Parts extra at cost"]}]'::jsonb,
    199, 199, 1200, true, 100
  ),
  (
    'svc_bike_service', 'car_and_bike', 'Doorstep Bike Service',
    'Complete bike servicing at your doorstep: oil, brakes, chain, tuning.',
    'bike', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600',
    '[{"name":"Basic Service","price":599,"features":["Oil change","Chain lube","Air pressure"]},{"name":"Full Service","price":1499,"features":["Complete tune-up","Brake pads","Filter change"]}]'::jsonb,
    599, 700, 1800, false, 0
  ),
  (
    'svc_car_service', 'car_and_bike', 'Car General Service',
    'Doorstep car service: oil, filters, brakes and 25-point inspection.',
    'car', 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600',
    '[{"name":"Essential","price":2499,"features":["Oil and filter","10-point check"]},{"name":"Comprehensive","price":4999,"features":["25-point check","Brake fluid"]}]'::jsonb,
    2499, 2800, 6500, false, 0
  )
on conflict (service_code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  image_url = excluded.image_url,
  tiers = excluded.tiers,
  base_price = excluded.base_price,
  market_min = excluded.market_min,
  market_max = excluded.market_max,
  is_flat_visit = excluded.is_flat_visit,
  booking_fee = excluded.booking_fee,
  active = true;

commit;
