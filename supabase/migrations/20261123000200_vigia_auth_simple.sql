-- VigIA · auth simple persistida en Supabase (sin Clerk)
-- Agrega los campos necesarios para passwords hasheados y sesiones reales.

alter table public.profiles
  add column if not exists password_hash text;

alter table public.sessions
  add column if not exists expires_at timestamptz;

create index if not exists sessions_expires_idx on public.sessions(expires_at);

-- Las contraseñas y los hashes nunca deben ser legibles desde el navegador.
-- RLS ya impide INSERT/UPDATE a anon/authenticated; reforzamos el permiso
-- explícito para que un futuro cambio de políticas no exponga la columna.
revoke select (password_hash) on public.profiles from anon, authenticated;

grant select (id, auth_subject, company_id, name, email, role, status, last_access, created_at, updated_at)
  on public.profiles to anon, authenticated;
