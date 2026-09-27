# Etusivun tuotenostot

Ylätunniste, nykyinen kategorianavigaatio ja footer säilyvät ennallaan. Etusivun sisältö on `apps/web/src/features/home/HomePage.tsx`, tekstit `home-copy.ts` ja omat tyylit `apps/web/src/styles/features/home/storefront.css`.

Heron korkeutta säädetään `--storefront-hero-height`-muuttujalla (oletus 360px). Hero täyttää sivun leveyden ja säilyttää sinisen CSS-gradientin. Sen keskellä on käyttäjän toimittamaan React Bits InfiniteSpiral -lähteeseen perustuva kuvakierre. Kuvina käytetään olemassa olevia komponenttikuvia; uusia PC-kuvia ei luoda. Molemmat animaatiot voi pysäyttää painikkeesta. Vähennetyn liikkeen asetusta kunnioitetaan. Kuvien vaihto: `apps/web/src/features/home/hero-spiral-items.ts`. Spiraalin tyylit: `styles/components/infinite-spiral.css`.

## Ilmoitusrivit

- Uusimmat: viisi uusinta myynnissä olevaa FI/EUR-ilmoitusta, järjestetty `published_at`-ajan mukaan. Vanha demodata käyttää tarvittaessa `createdAt`-aikaa. Näytä kaikki avaa nykyisen tuoteselaimen.
- Rigin tarjonta: julkinen `get_rigi_listing_ids` palauttaa vain aktiivisten, julkaistujen Suomen ilmoitusten tunnisteet. Myyjällä on oltava suojatun `user_roles`-taulun admin-rooli. Nimellä, Auth-metadatalla tai selaimen demorooleilla ei voi saada Rigi-merkkiä. Kaikki admin-tilien ilmoitukset kuuluvat tähän käyttäjän pyytämällä tavalla. Rooli tarkastetaan jokaisella haulla. Palvelu lukee korttien tiedot nykyisen julkisen ilmoitusrajapinnan kautta. Aluksi viisi korttia; Näytä kaikki laajentaa listan, ja jatkosivut haetaan 50 kerrallaan.
- Suositukset: aluksi enintään 24, yhdellä painalluksella enintään 48 yhteensä. Lisäyspainike poistuu. Raja säilyy sivuston sisäisessä navigoinnissa ja palautuu 24:ään sivun uudelleenlatauksessa. Myytyjä, varattuja, poistettuja, luonnoksia ja omia ilmoituksia ei suositella. Kortteja ei monisteta, jos tuotteita on vähemmän.

## Suositusten pisteytys

Pohjana ovat ilmoituspalvelun aktiiviset ilmoitukset. Palvelu lukee valikoiman 200 ilmoituksen sivuina, jotta myös vanhat ilmoitukset ovat mukana haussa ja lajittelussa. Suosikki antaa tuoteryhmälle 4 pistettä, samalla vierailulla katsottu ilmoitus 2; kiinnostuspisteet rajataan 12:een. Tuoreus antaa enintään 4 pistettä viikon aikajänteellä vähentyen. Sivun latauskohtainen satunnaissiemen tuo 0–5 pistettä vaihtelua. Jokainen jo valittu saman tuoteryhmän tuote vähentää seuraavien pisteitä 1,5 ja saman myyjän tuote 0,75: monipuolisuus säilyy. Algoritmi valitsee enintään 48 yksilöllistä tuotetta. Laajennus ei muuta ensimmäisten 24 järjestystä.

Katseluhistoria sisältää enintään 40 tunnistetta vain Reactin muistissa. Sitä ei lähetetä analytiikkapalveluun tai tallenneta selaimen pysyvään muistiin. Se tyhjennetään käyttäjän vaihtuessa. Suosikit tulevat nykyisestä käyttäjäkohtaisesta suosikkitoiminnosta. Sivun päivitys vaihtaa satunnaissiementä, joten ehdotukset voivat vaihtua; identtinen järjestys ei ole poissuljettu pienessä valikoimassa.

## Käyttöönotto ja rajat

Migraatio `20260926203455_home_official_listings.sql` asennettiin käyttäjän hyväksynnällä Supabaseen 26.9.2026. Paikallinen versionumero vastaa etätietokannan migraatiohistoriaa. Anonyymi luku varmistettiin; suojattu roolitaulu ei ole julkisesti luettavissa. Ilman sitä osio näyttää latausvirheen ja uudelleenyrityksen, eikä tavallisia tuotteita merkitä Rigin tuotteiksi. Rigin tarjonta piilotetaan kokonaan, jos onnistunut haku palauttaa tyhjän valikoiman. Latausvirhe näytetään erikseen, eikä sitä tulkita tyhjäksi tarjonnaksi. Haku päivittyy minuutin välein näkyvällä välilehdellä sekä palattaessa välilehdelle. Demotilassa osio käyttää ainoastaan koodiin sisältyviä, selvästi simuloituja Rigi-tuotteita, ei selaimessa muokattavissa olevaa käyttäjäroolia. Maksuturva ja Rigi-lähetys kuvataan tuleviksi palveluiksi; tuotantointegraatioita ei lisätä tässä muutoksessa.

Testit kattavat järjestyksen, 48 tuotteen rajan, personoinnin, vaihtelun, SQL-roolirajauksen, väärennetyn metadatan, roolin poiston, sivutuksen, mobiilileveyden, kielenvaihdon ja selaimen uudelleenlatauksen.

Supabasen tarkistin huomauttaa julkisesta SECURITY DEFINER -hausta. Julkinen käyttö on tässä tarkoituksellista: funktio palauttaa vain julkaistujen aktiivisten FI/EUR-ilmoitusten tunnisteet, ei rooliluetteloa tai yksityisiä tietoja. Rajattu sivutus, tyhjä hakupolku ja palvelimen roolitarkistus testataan SQL-testeissä.

## 100 tuotteen paikallinen esittely

`apps/web/src/data/simulated-listings.ts` luo 100 yksilöllistä demotuotetta kymmeneen tuoteryhmään. Näistä 20 havainnollistaa Rigin tarjontaa. Hinnat, myyjät, kaupungit ja tuotteet ovat esimerkkitietoja. Olemassa olevat kuvat ovat havainnollistavia. Alkuperäiset demotuotteet säilyvät näiden lisäksi.

Käynnistä projektikansiosta `npm.cmd run dev:demo` ja avaa http://localhost:4174/. Komento tyhjentää Supabase-asetukset vain käynnistettävän esittelypalvelimen ympäristöstä. `.env`-tiedostoja tai tietokantaa ei muuteta. Tavallinen Supabase-esikatselu säilyy osoitteessa http://localhost:4173/. Molemmat käyttävät samaa koodikansiota.

Etusivun adminin julkaisemat markkinointitiedotteet säilyvät käytössä. Ylänavigaatioon ja footeriin ei tehdä muutoksia.

Ilmoituskortin aika lasketaan julkaisuajasta: 0–59min, 1–23h, 1–7pv ja kahdeksannesta vuorokaudesta alkaen julkaisupäivämäärä Helsingin ajassa. Aika päivittyy puolen minuutin välein sekä palattaessa ikkunaan. Lajittelu käyttää samaa julkaisuhetkeä; vanha demodata käyttää luontiaikaa varalla, tuntematon aika näytetään viivana ja järjestetään viimeiseksi.
