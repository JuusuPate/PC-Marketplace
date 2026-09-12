# PC Marketplace

Finland-first, Nordic-ready -demo käytettyjen PC-komponenttien ja pelikoneiden markkinapaikasta.

## Mitä demossa toimii

- suomen-, ruotsin-, tanskan-, norjan- ja englanninkielinen käyttöliittymä
- Suomi-, Ruotsi-, Tanska- ja Norja-markkinoiden asetukset ja valuutat
- ilmoitusten haku, kategoriat, lajittelu ja markkinakohtainen toimitussuodatus
- tuotesivu, myyjän maine, testitiedot, sarjanumeron vahvistus ja ostajansuoja
- paikallinen demo-kirjautuminen tai valinnainen Supabase Auth sähköpostivahvistuksella
- ilmoituksen luonti paikallisesti tai Supabase-tietokantaan, suosikit ja demo-osto
- oma tili, tilaukset, omat ilmoitukset ja markkinoiden admin-esikatselu
- mobiiliin mukautuva käyttöliittymä

Ilman Supabase-asetuksia sovellus toimii edelleen paikallisena demona, eikä lähetä käyttäjätietoja palvelimelle. Kun Supabase on otettu käyttöön, käyttäjätilit, istunnot, profiilit ja käyttäjien julkaisemat ilmoitukset tallennetaan Supabaseen. Maksaminen, tilaukset ja suosikit ovat vielä paikallisia demotoimintoja.

## Käynnistys

Tarvitset Node.jsin (LTS-versio suositeltu).

```bash
npm install
npm run dev
```

Selain avautuu osoitteeseen `http://localhost:4173`.

Tuotantokäännös:

```bash
npm run build
```

## Supabase-kirjautumisen ja tietokannan käyttöönotto

1. Luo Supabase-projekti.
2. Suorita SQL-editorissa tiedostot `supabase/migrations/0001_initial.sql` ja `0002_auth_and_listing_persistence.sql` tässä järjestyksessä. Vaihtoehtoisesti linkitä paikallinen Supabase CLI -projekti ja suorita `supabase db push`.
3. Kopioi `apps/web/.env.example` tiedostoksi `apps/web/.env.local`.
4. Lisää ympäristötiedostoon projektin URL ja publishable key. Älä koskaan lisää selaimeen service role- tai secret key -avainta.
5. Lisää Supabasen Authentication → URL Configuration -asetuksiin kehityksessä `http://localhost:4173` ja tuotannossa palvelun HTTPS-osoite sekä sallitut redirect-osoitteet.
6. Käynnistä kehityspalvelin uudelleen komennolla `npm run dev`.

Kun molemmat `VITE_SUPABASE_*`-arvot löytyvät, yläpalkissa näkyy `SUPABASE BETA`. Muussa tapauksessa sovellus käyttää automaattisesti paikallista demotilaa.

## Rakenne

```text
PC-Marketplace/
├── apps/
│   └── web/                  # React/Vite-demopalvelu
│       └── src/
│           ├── app/          # Sovelluksen kokoonpano ja tila
│           ├── components/   # Yleiskäyttöiset käyttöliittymäosat
│           ├── config/       # Maa-, valuutta- ja markkina-asetukset
│           ├── data/         # Demodata (ei tuotantodataa)
│           ├── features/     # Auth, ilmoitukset, osto, myynti ja tili
│           ├── i18n/         # Kieliavaimet ja kielikohtaiset tiedostot
│           ├── lib/          # Raha- ja demo-tallennusapuohjelmat
│           ├── styles/       # Yhteinen design system
│           └── types/        # Jaetut TypeScript-tyypit
├── docs/                     # Arkkitehtuuri ja MVP:n rajaus
├── packages/                 # Tulevien web/admin/mobile-sovellusten jaettu koodi
├── supabase/migrations/      # Tuotantotietokannan lähtömalli
└── .github/workflows/        # Automaattinen build-tarkistus
```

Lisätiedot: [arkkitehtuuri](docs/architecture.md) ja [MVP-rajaus](docs/mvp-scope.md).

## Tärkeä tuotantoraja

Tämä on käyttöliittymä- ja tuotevirtojen demo, ei julkaisuvalmis rahaa käsittelevä markkinapaikka. Ennen oikeita käyttäjiä tarvitaan ainakin:

1. Supabase Auth on kytketty, mutta salasanan palautus, MFA ja kattavat käyttöoikeustestit puuttuvat
2. ulkopuolinen marketplace-maksupalvelu, KYC/onboarding ja payout-logiikka
3. tietoturva- ja maksujärjestelmäkatselmointi ammattilaisella
4. GDPR-, DSA-, DAC7-, kuluttajansuoja- ja veromallin juridinen tarkistus
5. valvottu kuvien tallennus, haitallisen sisällön käsittely ja audit trail
