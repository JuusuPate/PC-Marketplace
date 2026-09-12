# PC Marketplace

Finland-first, Nordic-ready -demo käytettyjen PC-komponenttien ja pelikoneiden markkinapaikasta.

## Mitä demossa toimii

- suomen-, ruotsin-, tanskan-, norjan- ja englanninkielinen käyttöliittymä
- Suomi-, Ruotsi-, Tanska- ja Norja-markkinoiden asetukset ja valuutat
- ilmoitusten haku, kategoriat, lajittelu ja markkinakohtainen toimitussuodatus
- tuotesivu, myyjän maine, testitiedot, sarjanumeron vahvistus ja ostajansuoja
- paikallinen demo-kirjautuminen ja tilin luonti
- ilmoituksen luonti, suosikit ja demo-osto
- oma tili, tilaukset, omat ilmoitukset ja markkinoiden admin-esikatselu
- mobiiliin mukautuva käyttöliittymä

Demo ei käsittele oikeita maksuja, henkilötietoja eikä lähetä tietoja palvelimelle. Demoistunto tallennetaan vain selaimen localStorageen. Tuotantoon siirryttäessä se korvataan esimerkiksi Supabase Authilla ja marketplace-maksut Stripe Connectilla tai erikseen arvioidulla pohjoismaisella palvelulla.

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

1. palvelinpuolinen autentikointi, sähköpostin vahvistus ja käyttöoikeustestit
2. ulkopuolinen marketplace-maksupalvelu, KYC/onboarding ja payout-logiikka
3. tietoturva- ja maksujärjestelmäkatselmointi ammattilaisella
4. GDPR-, DSA-, DAC7-, kuluttajansuoja- ja veromallin juridinen tarkistus
5. valvottu kuvien tallennus, haitallisen sisällön käsittely ja audit trail
