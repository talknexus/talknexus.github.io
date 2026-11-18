-- Store the PKCE challenge alongside each temporary login code.
alter table public.desktop_auth_codes
add column code_challenge text not null;

-- Create a rate-limited handoff code.
create or replace function public.create_desktop_auth_code(
    p_code_hash text,
    p_code_challenge text,
    p_user_id uuid,
    p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    -- Validate the SHA-256 base64url challenge.
    if p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' then
        raise exception 'Invalid code challenge';
    end if;

    -- Serialize code creation for this account.
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_user_id::text, 0)
    );

    -- Enforce one code per account every 60 seconds.
    if exists (
        select 1
        from public.desktop_auth_codes
        where user_id = p_user_id
          and created_at > now() - interval '60 seconds'
    ) then
        return false;
    end if;

    insert into public.desktop_auth_codes (
        code_hash,
        code_challenge,
        user_id,
        expires_at
    )
    values (
        p_code_hash,
        p_code_challenge,
        p_user_id,
        p_expires_at
    );

    return true;
end;
$$;

revoke all on function public.create_desktop_auth_code(
    text, text, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_desktop_auth_code(
    text, text, uuid, timestamptz
) to service_role;
