
-- Migration: Sync auth.users -> public.users
-- Run this in Supabase SQL Editor (Database -> SQL Editor) or include in your migration pipeline.

-- This migration creates trigger functions that keep `public.users` populated with a row
-- for each auth.users entry. It is intentionally defensive: any error during the sync
-- will be logged with RAISE NOTICE and will NOT abort the auth.users INSERT/UPDATE/DELETE.
-- The functions write the auth id into `public.users.auth_user_id::text` (not the table's
-- primary `id` column). Adjust column names if your schema differs.

-- 1) INSERT trigger: when a new auth.users row is created, insert a matching row into public.users
create or replace function public.sync_auth_user_to_public_users()
returns trigger
language plpgsql
as $$
declare
  jsoncol text;
  display_name text;
begin
  -- Determine if auth.users has any json/jsonb column (often `user_metadata`).
  select column_name into jsoncol
  from information_schema.columns
  where table_schema = 'auth'
    and table_name = 'users'
    and data_type in ('json','jsonb')
  limit 1;

  begin
    if jsoncol is not null then
      -- Try to pull full_name from the discovered JSON column; fall back to email prefix
      select coalesce((to_json(new) -> jsoncol) ->> 'full_name', split_part(new.email, '@', 1))
        into display_name;
    else
      select split_part(new.email, '@', 1) into display_name;
    end if;

    -- Upsert into public.users by auth_user_id (text). Use created_at = now() if missing.
    insert into public.users (auth_user_id, email, display_name, created_at)
    values (new.id::text, new.email, display_name, now())
    on conflict (auth_user_id) do update set
      email = excluded.email,
      display_name = coalesce(excluded.display_name, public.users.display_name);
  exception when others then
    -- Don't abort auth insert; record a notice so DB admins can investigate.
    raise notice 'sync_auth_user_to_public_users: failed for auth id=%, err=%', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_insert on auth.users;
create trigger trg_sync_auth_user_insert
after insert on auth.users
for each row execute procedure public.sync_auth_user_to_public_users();

-- 2) UPDATE trigger: keep email / display_name in sync when auth.users changes
create or replace function public.sync_auth_user_update_to_public_users()
returns trigger
language plpgsql
as $$
declare
  jsoncol text;
  display_name text;
begin
  select column_name into jsoncol
  from information_schema.columns
  where table_schema = 'auth'
    and table_name = 'users'
    and data_type in ('json','jsonb')
  limit 1;

  begin
    if jsoncol is not null then
      select coalesce((to_json(new) -> jsoncol) ->> 'full_name', split_part(new.email, '@', 1))
        into display_name;
    else
      select split_part(new.email, '@', 1) into display_name;
    end if;

    update public.users set
      email = new.email,
      display_name = display_name
    where auth_user_id = new.id::text;
  exception when others then
    raise notice 'sync_auth_user_update_to_public_users: failed for auth id=%, err=%', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_update on auth.users;
create trigger trg_sync_auth_user_update
after update on auth.users
for each row execute procedure public.sync_auth_user_update_to_public_users();

-- 3) DELETE trigger: mark as inactive if possible, else delete. Defensive to avoid failing auth delete.
create or replace function public.sync_auth_user_delete_from_public_users()
returns trigger
language plpgsql
as $$
begin
  begin
    -- Try marking inactive (preferred to preserve history)
    update public.users set is_active = false where auth_user_id = old.id::text;
  exception when undefined_column then
    -- If `is_active` column doesn't exist, fall back to delete
    begin
      delete from public.users where auth_user_id = old.id::text;
    exception when others then
      raise notice 'sync_auth_user_delete_from_public_users: delete fallback failed for auth id=%, err=%', old.id, sqlerrm;
    end;
  exception when others then
    raise notice 'sync_auth_user_delete_from_public_users: failed for auth id=%, err=%', old.id, sqlerrm;
  end;
  return old;
end;
$$;

drop trigger if exists trg_sync_auth_user_delete on auth.users;
create trigger trg_sync_auth_user_delete
after delete on auth.users
for each row execute procedure public.sync_auth_user_delete_from_public_users();

-- 4) One-off backfill: insert any missing auth.users into public.users
-- Use this if you already have users in auth.users and want to populate public.users
-- INSERT INTO public.users (auth_user_id, email, display_name, created_at)
-- SELECT u.id::text, u.email, coalesce((to_json(u) -> 'user_metadata') ->> 'full_name', split_part(u.email,'@',1)), now()
-- FROM auth.users u
-- LEFT JOIN public.users p ON p.auth_user_id = u.id::text
-- WHERE p.auth_user_id IS NULL;

