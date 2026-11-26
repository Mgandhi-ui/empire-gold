-- Empire Gold sales system (Nov 2026): website enquiries, leads, brokers (channel partners), bookings, payments, handover.
-- One database for empiregoldmazgaon.com and back.empiregoldmazgaon.com. Only the app's own server connects
-- (EG_DATABASE_URL). Row level security is ON for every table with NO policies, so Supabase's public keys can read
-- or write nothing. Safe to run twice.

-- ─── People who can sign in ──────────────────────────────────────────────────────────────────────────────────
-- admin: everything · staff: leads, inventory, bookings (no money settings) · partner: own clients and earnings
-- · customer: own flat, payments, updates.
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  phone       text,
  role        text not null check (role in ('admin','staff','partner','customer')),
  partner_id  text,
  customer_id text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);

create table if not exists otps (
  email       text primary key,
  code_hash   text not null,
  tries       int not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create table if not exists sessions (
  token_hash  text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create table if not exists hits_log (key text not null, at timestamptz not null default now());
create index if not exists hits_log_key_at on hits_log(key, at);

create table if not exists settings (key text primary key, value text not null, updated_at timestamptz not null default now());

-- ─── The 35 homes of Phase II ────────────────────────────────────────────────────────────────────────────────
create table if not exists flats (
  no           text primary key,
  floor        int not null,
  type         text not null,
  carpet_sqft  int not null,
  carpet_sqm   numeric(6,2) not null,
  status       text not null default 'available' check (status in ('available','hold','booked')),
  rate_sqft    int,                         -- set only in the back office; never shown on the website
  hold_until   timestamptz,
  hold_note    text,
  updated_at   timestamptz not null default now()
);

-- ─── Brokers ─────────────────────────────────────────────────────────────────────────────────────────────────
create sequence if not exists partner_seq;
create table if not exists partners (
  id            text primary key default 'EGP-' || lpad(nextval('partner_seq')::text, 3, '0'),
  firm          text not null,
  contact_name  text not null,
  phone         text not null,
  email         text not null,
  rera_no       text,
  area          text,
  status        text not null default 'applied' check (status in ('applied','active','paused','rejected')),
  brokerage_pct numeric(4,2) not null default 2.00,
  source        text not null default 'website',
  note          text,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);
create unique index if not exists partners_phone on partners(phone);

-- Brokers we would like to sign up (e.g. from the public MahaRERA agent register, a meet, a referral).
create table if not exists prospects (
  id         bigserial primary key,
  name       text not null,
  firm       text,
  phone      text,
  email      text,
  rera_no    text,
  area       text,
  source     text not null default 'manual',
  status     text not null default 'new' check (status in ('new','contacted','invited','joined','not_interested')),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists prospects_rera on prospects(rera_no) where rera_no is not null;

-- ─── Buyers ──────────────────────────────────────────────────────────────────────────────────────────────────
create sequence if not exists customer_seq;
create table if not exists customers (
  id          text primary key default 'EGC-' || lpad(nextval('customer_seq')::text, 4, '0'),
  name        text not null,
  phone       text not null,
  email       text,
  address     text,
  co_applicant text,
  created_at  timestamptz not null default now()
);
create unique index if not exists customers_phone on customers(phone);

-- ─── Leads ───────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists leads (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  name             text not null,
  phone            text not null,
  email            text,
  source           text not null check (source in ('website','meta','google','portal','broker','hoarding','referral','walk_in','other')),
  source_detail    text,                      -- ad name, campaign, ?ref= tag, referrer's name
  partner_id       text references partners(id),
  partner_until    date,                      -- the broker owns this lead until this date (60 days from registration)
  interested       text,
  budget           text,
  message          text,
  stage            text not null default 'new' check (stage in ('new','contacted','visit_booked','visited','negotiation','booked','lost')),
  next_follow_up   date,
  visit_at         timestamptz,
  flat_no          text references flats(no),
  lost_reason      text,
  owner_id         uuid references users(id),
  customer_id      text references customers(id),
  meta_lead_id     text unique,               -- Meta Lead Ads id, for sending quality signals back
  updated_at       timestamptz not null default now()
);
create index if not exists leads_phone on leads(phone);
create index if not exists leads_stage on leads(stage, next_follow_up);
create index if not exists leads_partner on leads(partner_id);

create table if not exists lead_notes (
  id       bigserial primary key,
  lead_id  bigint not null references leads(id) on delete cascade,
  at       timestamptz not null default now(),
  by_user  uuid references users(id),
  text     text not null
);
create index if not exists lead_notes_lead on lead_notes(lead_id, at);

-- ─── Bookings (one per flat sold) ────────────────────────────────────────────────────────────────────────────
create sequence if not exists booking_seq;
create table if not exists bookings (
  id                text primary key default 'EGB-' || lpad(nextval('booking_seq')::text, 4, '0'),
  flat_no           text not null references flats(no),
  customer_id       text not null references customers(id),
  partner_id        text references partners(id),
  lead_id           bigint references leads(id),
  booking_date      date not null default current_date,
  agreement_value   bigint not null check (agreement_value > 0),        -- rupees
  brokerage_pct     numeric(4,2) not null default 0,
  brokerage_amount  bigint generated always as (round(agreement_value * brokerage_pct / 100)) stored,
  status            text not null default 'booked' check (status in ('booked','agreement_registered','possession_offered','handed_over','cancelled')),
  agreement_date    date,
  possession_date   date,
  handover_date     date,
  note              text,
  created_by        uuid references users(id),
  created_at        timestamptz not null default now()
);
create unique index if not exists bookings_one_live_per_flat on bookings(flat_no) where status <> 'cancelled';
create index if not exists bookings_partner on bookings(partner_id);
create index if not exists bookings_customer on bookings(customer_id);

-- What the buyer owes and when (construction-linked stages, typed per booking or copied from the template).
create table if not exists payment_stages (
  id          bigserial primary key,
  booking_id  text not null references bookings(id) on delete cascade,
  seq         int not null,
  label       text not null,
  pct         numeric(5,2),
  amount      bigint not null check (amount >= 0),
  due_date    date,
  demanded_at date,
  unique (booking_id, seq)
);

create table if not exists receipts (
  id          bigserial primary key,
  booking_id  text not null references bookings(id) on delete cascade,
  date        date not null,
  amount      bigint not null check (amount > 0),
  mode        text not null check (mode in ('cheque','neft_rtgs','upi','home_loan','other')),
  reference   text,
  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create table if not exists brokerage_payouts (
  id          bigserial primary key,
  booking_id  text not null references bookings(id) on delete cascade,
  partner_id  text not null references partners(id),
  date        date not null,
  amount      bigint not null check (amount > 0),
  reference   text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- Papers per booking (allotment letter, agreement, receipts), kept as files in the database (small PDFs).
create table if not exists documents (
  id          bigserial primary key,
  booking_id  text not null references bookings(id) on delete cascade,
  title       text not null,
  mime        text not null,
  data        bytea not null,
  visible_to_customer boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Construction progress posts: shown to buyers in their login, and (if public) on the website.
create table if not exists updates (
  id          bigserial primary key,
  date        date not null default current_date,
  title       text not null,
  body        text not null,
  public      boolean not null default false,
  photo       bytea,
  photo_mime  text,
  created_at  timestamptz not null default now()
);

-- Everything that changes money, status or ownership, for the record.
create table if not exists audit (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  user_id  uuid,
  kind     text not null,
  ref      text,
  data     jsonb
);

-- Visits to the website, counted per day and source (no personal data).
create table if not exists site_hits (
  day     date not null,
  path    text not null,
  ref     text not null default '',
  n       int not null default 0,
  primary key (day, path, ref)
);

-- ─── Lock the doors: RLS on, no policies, nothing granted to Supabase's public roles ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['users','otps','sessions','hits_log','settings','flats','partners','prospects','customers','leads',
    'lead_notes','bookings','payment_stages','receipts','brokerage_payouts','documents','updates','audit','site_hits'] loop
    execute format('alter table %I enable row level security', t);
    begin execute format('revoke all on %I from anon, authenticated', t); exception when undefined_object then null; end;
  end loop;
end $$;

-- ─── Seed the 35 flats (MahaRERA carpet; master cost sheet, Aug 2026) ────────────────────────────────────────
insert into flats(no, floor, type, carpet_sqft, carpet_sqm) values
 ('803',8,'1.5 BHK',621,57.71),('804',8,'1 BHK',419,38.94),('805',8,'1 RK',296,27.50),
 ('901',9,'1 RK',298,27.67),('902',9,'1 RK',298,27.64),('903',9,'1 BHK (Large)',488,45.38),('904',9,'1 BHK',442,41.03),('905',9,'1 RK',296,27.50),
 ('1001',10,'1 RK',298,27.67),('1002',10,'1 RK',298,27.64),('1003',10,'1 BHK (Large)',488,45.38),('1004',10,'1 BHK',442,41.03),('1005',10,'1 RK',296,27.50),
 ('1101',11,'1 RK',298,27.67),('1102',11,'1 RK',298,27.64),('1103',11,'1 BHK (Large)',488,45.38),('1104',11,'1 BHK',442,41.03),('1105',11,'1 RK',296,27.50),
 ('1201',12,'1 RK',298,27.67),('1202',12,'1 RK',298,27.64),('1203',12,'1 BHK (Large)',488,45.38),('1204',12,'1 BHK',442,41.03),('1205',12,'1 RK',296,27.50),
 ('1301',13,'1 RK',298,27.67),('1302',13,'1 RK',298,27.64),('1303',13,'1 BHK (Large)',488,45.38),('1304',13,'1 BHK',442,41.03),('1305',13,'1 RK',296,27.50),
 ('1401',14,'1 RK',298,27.67),('1402',14,'1 RK',298,27.64),('1403',14,'1 BHK (Large)',488,45.38),('1404',14,'1 BHK',442,41.03),('1405',14,'1 RK',296,27.50),
 ('1501',15,'1 RK',298,27.67),('1502',15,'1 RK (Compact)',252,23.41)
on conflict (no) do nothing;

-- Default rate (₹ per sq.ft MahaRERA carpet) and brokerage, editable in Settings.
insert into settings(key, value) values ('rate_sqft','35000'), ('brokerage_pct','2'), ('partner_lock_days','60')
on conflict (key) do nothing;

-- The first admin. Change the email before running, or add more admins later in Settings.
insert into users(email, name, role) values ('mustanshir@empiregoldmazgaon.com', 'Mustanshir Gandhi', 'admin')
on conflict (email) do nothing;
