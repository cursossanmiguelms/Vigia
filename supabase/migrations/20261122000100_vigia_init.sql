-- VigIA · esquema inicial de la base de datos
-- Supabase Postgres 17
--
-- Objetivo de esta primera etapa:
--   * Guardar en Supabase toda la información de la plataforma y del monitoreo.
--   * Mantener la autenticación simple (demo) hasta integrar Clerk.
--   * Permitir lecturas desde dashboards con la publishable key.
--   * Reservar las escrituras al backend local con la secret key.
--
-- Cuando Clerk esté integrado, las políticas de lectura se reemplazan por
-- políticas basadas en el claim `sub` del JWT y en la empresa del usuario.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.vigia_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Planes
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id text primary key,
  name text not null,
  price numeric(10, 2) not null default 0,
  period text not null default '',
  billing text not null default '',
  seats integer not null default 0,
  duration_days integer not null default 30,
  skills text[] not null default '{}',
  color text not null default '#8B929B',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id text primary key,
  name text not null,
  short text not null default '',
  sector text not null default '',
  status text not null default 'active'
    check (status in ('active', 'trial', 'expired', 'suspended')),
  plan_id text references public.plans(id) on delete set null,
  seats integer not null default 0,
  users_count integer not null default 0,
  expires_at date,
  created_at date not null default current_date,
  contact text not null default '',
  email text not null default '',
  phone text not null default '',
  skills text[] not null default '{}',
  last_activity text not null default '',
  mrr numeric(10, 2) not null default 0,
  color text not null default '#22D3EE',
  domain text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Usuarios / perfiles
-- auth_subject queda reservado para el `sub` de Clerk.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id text primary key,
  auth_subject text unique,
  company_id text references public.companies(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'operator'
    check (role in ('creator', 'company_admin', 'supervisor', 'operator')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'invited')),
  last_access text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo de skills y skills habilitadas por empresa
-- ---------------------------------------------------------------------------

create table if not exists public.skills (
  id text primary key,
  name text not null,
  short text not null default '',
  status text not null default 'available'
    check (status in ('available', 'training', 'soon', 'retired')),
  group_name text not null default 'base',
  description text not null default '',
  industries text[] not null default '{}',
  icon text not null default 'layers',
  progress integer not null default 0 check (progress between 0 and 100),
  global_active boolean not null default false,
  companies_using integer not null default 0,
  featured boolean not null default false,
  pilot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_skills (
  company_id text not null references public.companies(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, skill_id)
);

-- ---------------------------------------------------------------------------
-- Solicitudes de acceso
-- ---------------------------------------------------------------------------

create table if not exists public.access_requests (
  id text primary key,
  type text not null default 'company'
    check (type in ('company', 'skill', 'seats', 'renewal')),
  company_id text references public.companies(id) on delete set null,
  company_name text not null,
  skill_id text references public.skills(id) on delete set null,
  detail text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  sector text not null default '',
  seats integer,
  plan_id text references public.plans(id) on delete set null,
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sesiones y auditoría
-- ---------------------------------------------------------------------------

create table if not exists public.sessions (
  id text primary key,
  profile_id text references public.profiles(id) on delete set null,
  company_id text references public.companies(id) on delete set null,
  user_name text not null default '',
  company_name text not null default '',
  role text not null default 'operator',
  ip text not null default '',
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  actor text not null default 'Sistema',
  action text not null,
  action_type text not null default 'system',
  target text not null default '',
  company_id text references public.companies(id) on delete set null,
  company_name text not null default '',
  ip text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  profile_id text references public.profiles(id) on delete cascade,
  company_id text references public.companies(id) on delete cascade,
  title text not null,
  body text not null default '',
  type text not null default 'info',
  unread boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies(id) on delete cascade,
  concept text not null default '',
  amount numeric(10, 2) not null default 0,
  method text not null default '',
  status text not null default 'Pagado',
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cámaras, zonas y configuración de la app
-- ---------------------------------------------------------------------------

create table if not exists public.cameras (
  id text primary key default gen_random_uuid()::text,
  company_id text references public.companies(id) on delete cascade,
  name text not null,
  host text not null default '',
  port integer,
  resolution text not null default '1280x720',
  lens text not null default '',
  notes text not null default '',
  active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zones (
  id text primary key default gen_random_uuid()::text,
  company_id text references public.companies(id) on delete cascade,
  camera_id text references public.cameras(id) on delete set null,
  name text not null,
  color text not null default '#22D3EE',
  x numeric(8, 6) not null default 0,
  y numeric(8, 6) not null default 0,
  w numeric(8, 6) not null default 0,
  h numeric(8, 6) not null default 0,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Configuración que hoy vive en localStorage: zonas completas, línea de aforo,
-- mapa de calor, EPP, mesas, caídas, áreas, perfiles de cámara y sonido.
-- El id es determinístico: '<company_id o global>:<kind>'.
create table if not exists public.app_configs (
  id text primary key,
  company_id text references public.companies(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Evidencia y eventos de monitoreo
-- ---------------------------------------------------------------------------

create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  company_id text references public.companies(id) on delete set null,
  camera_id text references public.cameras(id) on delete set null,
  filename text not null unique,
  label text not null default '',
  mode text not null default 'camera',
  event text not null default '',
  zone text not null default '',
  storage_bucket text not null default 'captures',
  storage_path text not null default '',
  public_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.alert_events (
  id bigint generated always as identity primary key,
  company_id text references public.companies(id) on delete set null,
  camera_id text references public.cameras(id) on delete set null,
  zone_id text references public.zones(id) on delete set null,
  capture_id uuid references public.captures(id) on delete set null,
  event text not null,
  message text not null default '',
  track_id text not null default '',
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.monitoring_metrics (
  id bigint generated always as identity primary key,
  company_id text references public.companies(id) on delete set null,
  camera_id text references public.cameras(id) on delete set null,
  persons integer not null default 0,
  visible_persons integer not null default 0,
  tracked_persons integer not null default 0,
  unique_persons integer not null default 0,
  fps numeric(8, 2),
  inference_ms numeric(8, 2),
  epp_compliance numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists companies_status_idx on public.companies(status);
create index if not exists companies_plan_idx on public.companies(plan_id);
create index if not exists profiles_company_idx on public.profiles(company_id);
create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists access_requests_status_idx on public.access_requests(status, created_at desc);
create index if not exists access_requests_company_idx on public.access_requests(company_id);
create index if not exists sessions_company_idx on public.sessions(company_id, started_at desc);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_company_idx on public.audit_log(company_id, created_at desc);
create index if not exists notifications_profile_idx on public.notifications(profile_id, created_at desc);
create index if not exists payments_company_idx on public.payments(company_id, paid_at desc);
create index if not exists cameras_company_idx on public.cameras(company_id);
create index if not exists zones_company_idx on public.zones(company_id);
create index if not exists app_configs_company_idx on public.app_configs(company_id, kind);
create index if not exists captures_company_idx on public.captures(company_id, captured_at desc);
create index if not exists captures_event_idx on public.captures(event, captured_at desc);
create index if not exists alert_events_company_idx on public.alert_events(company_id, occurred_at desc);
create index if not exists alert_events_event_idx on public.alert_events(event, occurred_at desc);
create index if not exists monitoring_metrics_company_idx on public.monitoring_metrics(company_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans
for each row execute function public.vigia_set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.vigia_set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.vigia_set_updated_at();

drop trigger if exists skills_set_updated_at on public.skills;
create trigger skills_set_updated_at before update on public.skills
for each row execute function public.vigia_set_updated_at();

drop trigger if exists company_skills_set_updated_at on public.company_skills;
create trigger company_skills_set_updated_at before update on public.company_skills
for each row execute function public.vigia_set_updated_at();

drop trigger if exists access_requests_set_updated_at on public.access_requests;
create trigger access_requests_set_updated_at before update on public.access_requests
for each row execute function public.vigia_set_updated_at();

drop trigger if exists cameras_set_updated_at on public.cameras;
create trigger cameras_set_updated_at before update on public.cameras
for each row execute function public.vigia_set_updated_at();

drop trigger if exists zones_set_updated_at on public.zones;
create trigger zones_set_updated_at before update on public.zones
for each row execute function public.vigia_set_updated_at();

drop trigger if exists app_configs_set_updated_at on public.app_configs;
create trigger app_configs_set_updated_at before update on public.app_configs
for each row execute function public.vigia_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Etapa actual (sin Clerk):
--   * anon/authenticated pueden LEER para alimentar dashboards.
--   * anon/authenticated NO pueden escribir.
--   * el backend local escribe con la secret key (service_role bypassa RLS).
--
-- Al integrar Clerk se reemplazan las políticas de lectura por:
--   company_id = (auth.jwt() ->> 'company_id')
--   o el mapeo auth_subject -> profiles.company_id.
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.company_skills enable row level security;
alter table public.access_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.cameras enable row level security;
alter table public.zones enable row level security;
alter table public.app_configs enable row level security;
alter table public.captures enable row level security;
alter table public.alert_events enable row level security;
alter table public.monitoring_metrics enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'plans', 'companies', 'profiles', 'skills', 'company_skills',
    'access_requests', 'sessions', 'audit_log', 'notifications', 'payments',
    'cameras', 'zones', 'app_configs', 'captures', 'alert_events',
    'monitoring_metrics'
  ]
  loop
    execute format('drop policy if exists "vigia_read_all" on public.%I', table_name);
    execute format(
      'create policy "vigia_read_all" on public.%I for select to anon, authenticated using (true)',
      table_name
    );
    execute format('grant select on public.%I to anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de capturas (lectura), escritura solo backend
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'captures',
  'captures',
  true,
  12582912,
  array['image/jpeg', 'image/png', 'application/json']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vigia_captures_public_read" on storage.objects;
create policy "vigia_captures_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'captures');
