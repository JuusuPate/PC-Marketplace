-- Public legal pages with server-enforced admin editing.
-- Bootstrap an admin only through the Supabase SQL editor or another service-role process:
-- insert into public.user_roles (user_id, role) values ('USER_UUID', 'admin');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant all on table public.user_roles to service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

create table public.legal_pages (
  slug text not null check (slug in ('terms', 'privacy', 'accessibility')),
  locale text not null check (locale in ('fi', 'sv', 'da', 'nb', 'en')),
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 10 and 500),
  body text not null check (char_length(body) between 20 and 30000),
  is_published boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (slug, locale)
);

create trigger set_legal_pages_updated_at
  before update on public.legal_pages
  for each row execute procedure public.set_updated_at();

alter table public.legal_pages enable row level security;

create policy "published legal pages are publicly readable"
  on public.legal_pages for select to anon, authenticated
  using (is_published = true);

revoke all on table public.legal_pages from anon, authenticated;
grant select on table public.legal_pages to anon, authenticated;
grant all on table public.legal_pages to service_role;

insert into public.legal_pages (slug, locale, title, summary, body)
values
  (
    'terms',
    'fi',
    'Käyttöehdot',
    'Nämä käyttöehdot ovat PC Marketin demoversion luonnos. Sisältö tarkistetaan ja täydennetään ennen palvelun varsinaista julkaisua.',
    $terms$
## 1. Palvelun tarkoitus
PC Market on Suomessa toimiva tietokoneiden, komponenttien ja oheislaitteiden markkinapaikka. Palvelu auttaa käyttäjiä julkaisemaan ilmoituksia sekä löytämään tuotteita muilta käyttäjiltä.

## 2. Käyttäjätili
Käyttäjä vastaa antamiensa tietojen oikeellisuudesta, tilinsä turvallisuudesta ja kaikesta tilillään tapahtuvasta toiminnasta.

## 3. Ilmoitukset
Myyjä vastaa siitä, että ilmoituksen kuvaus, kuvat, kunto, hinta ja muut tuotetiedot ovat paikkansapitäviä. Palvelussa ei saa myydä lainvastaisia tai muiden oikeuksia loukkaavia tuotteita.

## 4. Kaupankäynti
Ostaja ja myyjä vastaavat tekemänsä kaupan tiedoista ja sovituista toimitusehdoista. Demoversio ei käsittele oikeita maksuja.

## 5. Sisällön valvonta
PC Market voi poistaa sääntöjen vastaisia ilmoituksia ja rajoittaa tilin käyttöä palvelun turvallisuuden varmistamiseksi.

## 6. Vastuu ja ehtojen muutokset
Lopullisiin ehtoihin lisätään ennen julkaisua palveluntarjoajan viralliset yhteystiedot, vastuunrajaukset, riidanratkaisu ja kuluttajalle kuuluvat lakisääteiset oikeudet.
$terms$
  ),
  (
    'privacy',
    'fi',
    'Tietosuoja',
    'Tämä tietosuojaseloste on demoversion luonnos. Rekisterinpitäjän tiedot, säilytysajat ja palveluntarjoajat täydennetään ennen tuotantojulkaisua.',
    $privacy$
## 1. Mitä tietoja käsitellään
Palvelu voi käsitellä käyttäjätilin tietoja, ilmoitusten sisältöä, julkista paikkakuntaa ja palvelun käyttöön liittyviä teknisiä tietoja. Tarkkaa nouto-osoitetta ei näytetä julkisessa ilmoituksessa.

## 2. Miksi tietoja käsitellään
Tietoja käytetään käyttäjätilin ylläpitämiseen, ilmoitusten julkaisemiseen, kauppojen mahdollistamiseen, väärinkäytösten ehkäisemiseen, asiakaspalveluun ja palvelun kehittämiseen.

## 3. Tietojen vastaanottajat
Tuotantoversioon dokumentoidaan kaikki henkilötietoja käsittelevät palveluntarjoajat ja mahdolliset tietojen siirrot.

## 4. Säilytys ja suojaus
Tietoja säilytetään vain niin kauan kuin käyttötarkoitus tai lakisääteinen velvoite sitä edellyttää. Käyttöoikeudet rajataan tehtävien mukaan.

## 5. Käyttäjän oikeudet
Lopulliseen selosteeseen kuvataan käyttäjän sovellettavan lainsäädännön mukaiset oikeudet ja yhteydenottotapa pyyntöjä varten.

## 6. Yhteydenotot
Rekisterinpitäjän virallinen nimi, osoite ja yhteystiedot lisätään ennen palvelun varsinaista julkaisua.
$privacy$
  ),
  (
    'accessibility',
    'fi',
    'Saavutettavuus',
    'PC Marketin tavoitteena on tarjota mahdollisimman selkeä ja saavutettava palvelu. Tämä seloste täydennetään auditoinnin jälkeen ennen tuotantojulkaisua.',
    $accessibility$
## 1. Saavutettavuuden tila
Palvelu on vielä demovaiheessa, eikä sille ole tehty kattavaa ulkopuolista saavutettavuusauditointia. Tavoitteena on noudattaa soveltuvia WCAG 2.1 AA -tason vaatimuksia ennen varsinaista julkaisua.

## 2. Huomioidut ominaisuudet
Käyttöliittymässä käytetään semanttisia otsikoita, näppäimistöllä käytettäviä toimintoja, näkyviä kohdistustiloja, tekstivastineita ja riittävän suuria tekstejä.

## 3. Tunnetut puutteet
Demoversion kaikkia näkymiä, lomakkeita ja kolmansien osapuolten sisältöjä ei ole vielä testattu avustavilla teknologioilla.

## 4. Anna palautetta
Virallinen saavutettavuuspalautteen kanava ja tavoitevastausaika lisätään tähän selosteeseen ennen julkaisua.

## 5. Valvonta
Lopulliseen selosteeseen lisätään sovellettavan lainsäädännön mukaiset valvontaviranomaisen tiedot ja toimintaohjeet.
$accessibility$
  )
on conflict (slug, locale) do nothing;

create or replace function public.upsert_legal_page(
  p_slug text,
  p_locale text,
  p_title text,
  p_summary text,
  p_body text
)
returns setof public.legal_pages
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_page public.legal_pages;
begin
  if (select auth.uid()) is null or not public.is_current_user_admin() then
    raise exception 'Admin permission required' using errcode = '42501';
  end if;
  if p_slug not in ('terms', 'privacy', 'accessibility') then
    raise exception 'Unsupported legal page';
  end if;
  if p_locale not in ('fi', 'sv', 'da', 'nb', 'en') then
    raise exception 'Unsupported locale';
  end if;
  if char_length(trim(p_title)) not between 3 and 120 then
    raise exception 'Title must contain 3 to 120 characters';
  end if;
  if char_length(trim(p_summary)) not between 10 and 500 then
    raise exception 'Summary must contain 10 to 500 characters';
  end if;
  if char_length(trim(p_body)) not between 20 and 30000 then
    raise exception 'Body must contain 20 to 30000 characters';
  end if;

  insert into public.legal_pages (slug, locale, title, summary, body, is_published, updated_by)
  values (p_slug, p_locale, trim(p_title), trim(p_summary), trim(p_body), true, (select auth.uid()))
  on conflict (slug, locale) do update
  set title = excluded.title,
      summary = excluded.summary,
      body = excluded.body,
      is_published = true,
      updated_by = excluded.updated_by
  returning * into saved_page;

  return next saved_page;
  return;
end;
$$;

revoke execute on function public.upsert_legal_page(text, text, text, text, text) from public, anon;
grant execute on function public.upsert_legal_page(text, text, text, text, text) to authenticated, service_role;
