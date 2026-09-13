# PC Marketplace

Finland-first, Nordic-ready -demo käytettyjen PC-komponenttien ja pelikoneiden markkinapaikasta.

## Mitä demossa toimii

- suomen-, ruotsin- ja englanninkielinen käyttöliittymä Suomen käyttäjille
- vain Suomen markkina, eurohinnoittelu ja toimitukset Suomessa
- Ruotsin, Tanskan ja Norjan asetukset ovat rakenteessa valmiina mutta pois käytöstä
- ilmoitusten haku, lajittelu sekä omat URL-sivut komponenteille, pelikoneille ja muille pääkategorioille
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
2. Suorita SQL-editorissa `supabase/migrations`-hakemiston migraatiot numerojärjestyksessä (`0001`, `0002`, `0003`). Vaihtoehtoisesti linkitä paikallinen Supabase CLI -projekti ja suorita `supabase db push`.
3. Kopioi `apps/web/.env.example` tiedostoksi `apps/web/.env.local`.
4. Lisää ympäristötiedostoon projektin URL ja publishable key. Älä koskaan lisää selaimeen service role- tai secret key -avainta.
5. Lisää Supabasen Authentication → URL Configuration -asetuksiin kehityksessä `http://localhost:4173` ja tuotannossa palvelun HTTPS-osoite sekä sallitut redirect-osoitteet.
6. Käynnistä kehityspalvelin uudelleen komennolla `npm run dev`.

Kun molemmat `VITE_SUPABASE_*`-arvot löytyvät, yläpalkissa näkyy `SUPABASE BETA`. Muussa tapauksessa sovellus käyttää automaattisesti paikallista demotilaa.

## Julkaisumarkkina

Julkinen beta toimii vain Suomessa: käyttäjämaa ja ilmoitusmarkkina ovat `FI`, valuutta on `EUR` ja toimitusmaa on `FI`. Selain näyttää kieliksi suomen, ruotsin ja englannin. Pohjoismaiset maa-, valuutta- ja lokalisointityypit säilyvät lähdekoodissa myöhempää laajentumista varten, mutta niitä ei voi ottaa käyttöön pelkällä käyttöliittymämuutoksella — myös tietokantamigraation turvarajat on silloin päivitettävä hallitusti.

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
