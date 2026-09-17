# PC Marketplace

Finland-first, Nordic-ready -demo käytettyjen PC-komponenttien ja pelikoneiden markkinapaikasta.

## Mitä demossa toimii

- suomen-, ruotsin- ja englanninkielinen käyttöliittymä Suomen käyttäjille
- vain Suomen markkina, eurohinnoittelu ja toimitukset Suomessa
- Ruotsin, Tanskan ja Norjan asetukset ovat rakenteessa valmiina mutta pois käytöstä
- ilmoitusten haku, lajittelu, omat URL-sivut pääkategorioille sekä Pelikoneet- ja Näytönohjaimet-valikoiden jaettavat suodatinlinkit
- pääsivun kolmen ilmoituksen vaihtuva nosto, manuaaliset hallintapainikkeet ja suoraan ilmoitussivuille vievät kortit
- tuotesivu, myyjän maine, testitiedot, sarjanumeron vahvistus ja ostajansuoja
- paikallinen demo-kirjautuminen tai valinnainen Supabase Auth sähköpostivahvistuksella
- oma ilmoituksenluontisivu, pakollisten kenttien merkinnät, tuotetyypin mukaan vaihtuvat tekniset tiedot, tarkempi kuvaus ja enintään viisi tuotekuvaa
- ilmoituksen luonti paikallisesti tuotelistaan tai Supabase-tietokantaan, yksityinen nouto-osoite, suosikit ja demo-osto
- oma tili, tilaukset ja omat ilmoitukset
- käyttöehdot, tietosuoja- ja saavutettavuussivu sekä admin-oikeudella toimiva sisältöeditori
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
2. Suorita SQL-editorissa `supabase/migrations`-hakemiston migraatiot numerojärjestyksessä (`0001`–`0007`). Vaihtoehtoisesti linkitä paikallinen Supabase CLI -projekti ja suorita `supabase db push`. Neljäs migraatio lisää ilmoituskuvat ja myyjän yksityisen nouto-osoitteen, viides sisältösivut ja admin-roolit, kuudes hallittavan komponenttikatalogin ja seitsemäs admin-yleiskatsauksen.
3. Kopioi `apps/web/.env.example` tiedostoksi `apps/web/.env.local`.
4. Lisää ympäristötiedostoon projektin URL ja publishable key. Älä koskaan lisää selaimeen service role- tai secret key -avainta.
5. Lisää Supabasen Authentication → URL Configuration -asetuksiin kehityksessä `http://localhost:4173` ja tuotannossa palvelun HTTPS-osoite sekä sallitut redirect-osoitteet.
6. Käynnistä kehityspalvelin uudelleen komennolla `npm run dev`.

Kun molemmat `VITE_SUPABASE_*`-arvot löytyvät, yläpalkissa näkyy `SUPABASE BETA`. Muussa tapauksessa sovellus käyttää automaattisesti paikallista demotilaa.

### Admin-oikeuden lisääminen

Tuotantotilan admin-oikeus tallennetaan suojattuun `user_roles`-tauluun. Käyttäjä ei voi antaa oikeutta itselleen selaimesta. Kun käyttäjätili on luotu, lisää oikeus Supabasen SQL-editorissa palvelimen ylläpitäjänä:

```sql
insert into public.user_roles (user_id, role)
values ('KÄYTTÄJÄN_UUID', 'admin');
```

Admin voi avata Käyttöehdot-, Tietosuoja- tai Saavutettavuus-sivun ja valita **Muokkaa sivua**. Julkinen sisältö on kaikkien luettavissa, mutta tallennus tarkistetaan aina Supabasen palvelinpuolella. Paikallisessa demotilassa toiminnon voi testata kirjautumisikkunan **Käytä admin-demotunnusta** -painikkeella; tämä paikallinen rooli on vain käyttöliittymädemo eikä tuotannon turvaraja.

Migraatio `0006_catalog_taxonomy.sql` lisää kategoriat, kategoriakohtaiset brändit, teknisten tietojen määrittelyt ja kategoriapalkin suodatinvalinnat. Julkinen selain voi vain lukea aktiivisen Suomen katalogin. Navigaatiovalinnan lisääminen tai muokkaaminen tehdään admin-roolin tarkistavan `save_catalog_navigation_item`-funktion kautta ja muutos kirjataan audit-lokiin; selain ei saa suoraa kirjoitusoikeutta katalogitauluihin. Varsinainen `/admin/katalogi`-editori toteutetaan erillisenä käyttöliittymämoduulina.

### Admin Dashboard: vaihe 1

Migraation `0007_admin_overview.sql` jälkeen ylläpitäjä voi avata oman tilin **Admin Dashboard** -painikkeen tai osoitteen `/admin`. Yleiskatsaus näyttää tietokannan käyttäjämäärän, viimeisen seitsemän päivän uudet käyttäjät, ilmoitusten tilat, tilausmäärät, avoimet raportit sekä valmiiden kauppojen tuotteiden arvon ja palvelumaksut sentin tarkkuudella.

Luvut haetaan yhdellä admin-oikeuden tarkistavalla `get_admin_overview`-kutsulla. Paikalliset demoilmoitukset ja demo-ostot eivät sisälly mittareihin. Demotilassa Dashboard kertoo tarvittavasta palveluyhteydestä. Olemassa olevan Supabase-projektin käyttöönottoon tarvitaan vain uusi `0007`-migraatio; aiempia migraatioita ei suoriteta uudelleen.

Toteutuksen rajaus, mittarien määritelmät ja seuraavat vaiheet: [Admin Dashboardin toteutus](docs/admin-dashboard.md).

Testit ajetaan komennolla `npm test`. Ne sisältävät koko migraatioketjun asentavat PostgreSQL-testit, palvelukutsun ja vastausvalidoinnin testit sekä näkymän ja istunnon käyttöoikeustestit. Testit eivät tarvitse tuotannon tunnuksia eivätkä muuta yhdistetyn Supabase-projektin dataa.

## Julkaisumarkkina

Julkinen beta toimii vain Suomessa: käyttäjämaa ja ilmoitusmarkkina ovat `FI`, valuutta on `EUR` ja toimitusmaa on `FI`. Selain näyttää kieliksi suomen, ruotsin ja englannin. Pohjoismaiset maa-, valuutta- ja lokalisointityypit säilyvät lähdekoodissa myöhempää laajentumista varten, mutta niitä ei voi ottaa käyttöön pelkällä käyttöliittymämuutoksella — myös tietokantamigraation turvarajat on silloin päivitettävä hallitusti.

## Pääsivun nostojen valinta

Esittely näyttää kolme ilmoitusta kerrallaan. Kaksi paikkaa valitaan painottaen viimeisen seitsemän päivän anonyymejä katseluja ja tallennuksia, ja yksi paikka valitaan satunnaisesti. Näin kiinnostavat tuotteet saavat näkyvyyttä, mutta myös uusi ilmoitus voi nousta esiin ennen kuin sille on kertynyt tilastoja. Samassa kolmikossa ei ole duplikaatteja, ja uuden kierroksen alkaessa juuri näytetty kolmikko ohitetaan aina kun ilmoituksia on riittävästi.

Demoversio käyttää erillistä esimerkkisignaalien karttaa. Tuotannossa luvut tuodaan palvelimelta aggregoituina, myyjän omat katselut ja toistuva liikenne suodatetaan pois eikä yksittäisen käyttäjän suosikkeja käytetä yleisen suosion mittarina. Pääkortti vaihtuu 7,5 sekunnin välein. Vaihto pysähtyy automaattisesti osoittimen, näppäimistökohdistuksen, taustavälilehden tai vähennetyn liikkeen asetuksen ajaksi.

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

Lisätiedot: [arkkitehtuuri](docs/architecture.md), [MVP-rajaus](docs/mvp-scope.md) ja
[kategoriakuvien lähteet](docs/image-credits.md).

## Tärkeä tuotantoraja

Tämä on käyttöliittymä- ja tuotevirtojen demo, ei julkaisuvalmis rahaa käsittelevä markkinapaikka. Ennen oikeita käyttäjiä tarvitaan ainakin:

1. Supabase Auth on kytketty, mutta salasanan palautus, MFA ja kattavat käyttöoikeustestit puuttuvat
2. ulkopuolinen marketplace-maksupalvelu, KYC/onboarding ja payout-logiikka
3. tietoturva- ja maksujärjestelmäkatselmointi ammattilaisella
4. GDPR-, DSA-, DAC7-, kuluttajansuoja- ja veromallin juridinen tarkistus
5. valvottu kuvien tallennus, haitallisen sisällön käsittely ja audit trail
