-- Auth remains the email authority. Only public name/avatar are mirrored.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',true,524288,array['image/webp']);
create policy "users insert their avatar files" on storage.objects for insert to authenticated
with check(bucket_id='profile-avatars' and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.webp$'));
create policy "users read their avatar objects" on storage.objects for select to authenticated
using(bucket_id='profile-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "users delete unused avatar files" on storage.objects for delete to authenticated
using(bucket_id='profile-avatars' and split_part(name,'/',1)=(select auth.uid())::text
  and not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.avatar_path=name));

create function public.sync_public_profile_from_auth() returns trigger
language plpgsql security definer set search_path='' as $$
declare selected_name text; selected_avatar text;
begin
  if new.raw_user_meta_data->>'display_name' is not distinct from old.raw_user_meta_data->>'display_name'
    and new.raw_user_meta_data->>'avatar_path' is not distinct from old.raw_user_meta_data->>'avatar_path' then return new; end if;
  select display_name into selected_name from public.profiles where id=new.id;
  selected_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',selected_name));
  if selected_name is null or char_length(selected_name) not between 2 and 60 then
    raise exception 'Invalid display name' using errcode='22023'; end if;
  selected_avatar:=nullif(new.raw_user_meta_data->>'avatar_path','');
  if selected_avatar is not null and (
    selected_avatar !~ ('^'||new.id::text||'/[0-9a-f-]{36}\.webp$')
    or not exists(select 1 from storage.objects where bucket_id='profile-avatars' and name=selected_avatar)
  ) then raise exception 'Invalid avatar' using errcode='22023'; end if;
  update public.profiles set display_name=selected_name,avatar_path=selected_avatar where id=new.id;
  return new;
end $$;
revoke all on function public.sync_public_profile_from_auth() from public,anon,authenticated;
create trigger sync_public_profile_from_auth after update of raw_user_meta_data on auth.users
for each row execute function public.sync_public_profile_from_auth();

-- Capability marker: the client fails closed until this complete migration is installed.
create function public.get_profile_editing_enabled() returns boolean
language sql stable security invoker set search_path='' as $$select true$$;
revoke all on function public.get_profile_editing_enabled() from public;
grant execute on function public.get_profile_editing_enabled() to anon,authenticated,service_role;
