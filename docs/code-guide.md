# Koodikartta tiimille

Tämä opas kertoo, mistä toiminnon toteutus alkaa ja missä sen tietoja käsitellään.
Funktioiden yhteydessä olevat suomenkieliset JSDoc-kommentit kuvaavat tarkoituksen,
tärkeät sivuvaikutukset ja rajaukset. Ne näkyvät myös editorin funktiovihjeissä.

## Kansioiden vastuut

| Polku                                                       | Vastuu                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/App.tsx`                                  | Reittitila, istunto, yhteiset ilmoituslistat ja modaalien koordinointi.                                                    |
| `apps/web/src/features/`                                    | Toimintokohtaiset näkymät: myynti, kategoriat, ylläpito, kirjautuminen, etusivu ja sisältösivut.                           |
| `apps/web/src/components/`                                  | Jaetut käyttöliittymäosat, kuten ilmoituskortti, kuvat, navigaatio ja saavutettava dialogi.                                |
| `apps/web/src/lib/`                                         | Palvelukutsut, vastausten tarkistus sekä erilliset laskenta- ja normalisointifunktiot.                                     |
| `apps/web/src/config/`                                      | Tuetut reitit, kategoriat ja markkina-asetukset.                                                                           |
| `apps/web/src/types/index.ts`                               | Yhteiset käyttöliittymän tietomallit.                                                                                      |
| `apps/web/src/i18n/`                                        | Kielikohtaiset tekstit. Osa toimintojen teksteistä sijaitsee niiden omissa `*-copy.ts`-tiedostoissa.                       |
| `apps/web/src/styles/`                                      | Jaetut, komponenttikohtaiset ja toimintokohtaiset tyylit. Katso myös [tyylien työnjako](../apps/web/src/styles/README.md). |
| `apps/web/src/data/`                                        | Demotuotteet, paikallinen katalogi ja sijaintidata.                                                                        |
| `scripts/`                                                  | Kehitys- ja datan muodostustyökalut.                                                                                       |
| `supabase/migrations/`                                      | Tietokannan rakenteen, RPC-toimintojen ja käyttöoikeuksien muutokset.                                                      |
| `tests/*.test.ts`, `tests/e2e/`, `supabase/tests/database/` | Laskentalogiikan, tietokannan oikeuksien ja selainpolkujen tarkistukset.                                                   |

## Tärkeimmät toimintopolut

**Ilmoituksen luonti ja muokkaus.** `CreateListingPage` kerää arvot viidessä vaiheessa.
`specification-fields` määrittää kategoriakohtaiset kentät, ja `listing-profile`
alustaa, tarkistaa, otsikoi ja serialisoi niiden tiedot. `ProductModelPicker` käyttää
`product-model-service`-hakua. Pelikoneen osat käyttävät omia komponenttikatalogejaan.
Tuotetietojen **Tallenna** vahvistaa vain nykyisen lomakkeen tiedot; varsinainen
ilmoituksen tallennus kulkee viimeisessä vaiheessa Appin kautta `listing-service`en.

**Kuvat.** `ImagePicker` hallitsee valintaa ja järjestystä. `listing-images` tarkistaa
ja pakkaa kuvat sekä luo paikalliset esikatseluosoitteet. `listing-service` varaa
Storage-polut palvelimelta, lataa kuvat ja viimeistelee julkaisemisen. Kuvia vaihdettaessa
vanhat viitteet säilyvät uusien lataukseen ja tietokannan viimeistelyyn asti.

**Haku ja sijaintisuodatus.** `marketplace-filters` normalisoi tietoja ja soveltaa
valinnat: vaihtoehdot saman ryhmän sisällä yhdistetään TAI-ehdolla ja eri ryhmät JA-ehdolla.
`finnish-locations` yhdistää kuntien suomen- ja ruotsinkieliset nimet samaan tunnisteeseen.
App suodattaa ja lajittelee koko tulosjoukon ennen 24 ilmoituksen sivutusta.
`listing-time` käsittelee sekä julkaisuhetken lajittelun että erillisen ikätekstin.

**Etusivun valinnat.** `home-recommendations` pisteyttää ilmoitukset suosikkien,
katselujen, tuoreuden ja sivun latauksen ajan vakaan satunnaisuuden perusteella.
Se valitsee enintään 48 suositusta ja vähentää saman myyjän tai kategorian toistoa.
`home-official-service` hakee Rigin tarjonnan palvelimen määrittämistä admin-myyjistä.
`HomePage` esittää nämä listat ja hallitsee niiden näyttömäärää.

**Ylläpito.** Näkymät sijaitsevat `features/admin`-kansiossa. `adminRpc` on suojattujen
lukukutsujen yhteinen apuri, ja `parse*`-funktiot tarkistavat vastaukset ennen näyttämistä.
`AdminCharts` tarjoaa yhteisen jaksonvalinnan, päiväkäyrät ja vaihtoehtoisen tietotaulukon.
Käyttäjien kokonaismäärä on kertymä, kun taas uudet käyttäjät ovat päivittäisiä tapahtumia.
Mallin hinnat ja niiden muutokset tulevat `admin-model-trends-service`stä; puuttuva hintanäyte
säilyy `null`-arvona eikä sitä piirretä nollahintana.

## Periaatteet, jotka muutoksissa tulee säilyttää

- Rahamäärät tallennetaan kokonaislukusenteissä. `formatMoney` muuntaa ne esitystä varten.
- Julkinen `Listing` sisältää vain paikkakunnan. `PrivatePickupAddress` haetaan erikseen oikeuden tarkistavan polun kautta.
- Selaimen `role` ohjaa näkyvyyttä. Supabasen RPC-toiminnot ja RLS varmistavat varsinaiset käyttöoikeudet.
- Asynkronisen haun siivous mitätöi vastauksen, kun käyttäjä, hakuehto tai näkymä vaihtuu. Älä poista tätä suojausta.
- Ylläpidon kirjoituksissa odotettu versio estää rinnakkaisen muutoksen ylikirjoittamisen. Konfliktin jälkeen tarvitaan tuore tieto.
- `demoStorage` on vain paikallinen demo. `CheckoutModal` ja `DemoOrder` eivät toteuta oikeaa maksua, vaikka demotilaus merkitään maksetuksi.
- `demo-catalog.json` muodostetaan katalogimigraatioista `scripts/build-demo-catalog.mjs`-työkalulla. Datageneraattorin tai migraation muutos tarvitsee oman tarkistuksensa.

Kommentoi jatkossa toiminnon tarkoitus, epäselvä syy ja tärkeä rajoite. Tavallista
kentän asettamista tai suoraan nimestä selvää toimintoa ei tarvitse selittää rivi riviltä.
Päivitä kommentti samassa muutoksessa kuin sen kuvaama toiminta. Pidä käännökset,
generoitu data ja olemassa olevat migraatiot erillään pelkistä dokumentointimuutoksista.
