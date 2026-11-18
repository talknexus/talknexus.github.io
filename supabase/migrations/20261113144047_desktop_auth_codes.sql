create table public.desktop_auth_codes (
    id uuid primary key default gen_random_uuid(),
    code_hash text not null unique,
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    consumed_at timestamptz
);

-- Only trusted server-side code should access this table.
alter table public.desktop_auth_codes enable row level security;

revoke all on public.desktop_auth_codes from anon, authenticated;
grant all on public.desktop_auth_codes to service_role;

-- Index to make expiration cleanup and lookups efficient.
create index desktop_auth_codes_expires_at_idx
on public.desktop_auth_codes (expires_at);

create index desktop_auth_codes_user_id_idx
on public.desktop_auth_codes (user_id);