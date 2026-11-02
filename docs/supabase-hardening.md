# Supabasen käyttöoikeus- ja indeksikorjaus

Korjaus perustuu elävän PC-Marketplace SUOMI -projektin 2.11.2026 Advisor-tarkistukseen.

## Muutokset

- `rls_auto_enable()` säilyy käytössä tietokantataulujen RLS-suojauksen automaattisena tapahtumatriggerinä. Sen tarpeeton `EXECUTE` poistetaan `PUBLIC`-, `anon`- ja `authenticated`-rooleilta. Jos hallitun Supabasen funktiota ei ole paikallisessa pinossa, tämä osa ohitetaan.
- Kolmetoista puuttuvaa viiteavainindeksiä kattaa koko taulun ja alkaa viiteavainsarakkeesta. Aikaisempia indeksejä ei poisteta käyttölaskurin perusteella.
- Kahdeksassa katalogitaulussa anonyymi rooli käyttää aiempaa julkista SELECT-ehtoa. Kirjautuneen roolin yksi SELECT-policy yhdistää aiemmat julkisen ja admin-lukemisen ehdot TAI-operaatiolla. Admin-tarkistus tehdään `(select public.is_current_user_admin())`-alikyselynä kerran lauseketta kohden.

Taulukohtaiset julkiset ehdot, FI-markkinarajaus, aktiivisuusehdot ja roolitaulun palvelinpuolinen tarkistus säilyvät. Selainrooleille ei myönnetä uusia taulujen kirjoitusoikeuksia eikä suljetuille ylläpitotauluille lisätä julkisia policyjä.

Migraatio käyttää viiden sekunnin lukitusodotusta ja 45 sekunnin lausekerajaa. Indeksien luonti on tavallinen transaktion sisäinen operaatio: tarkistetut tuotantotaulut ovat pieniä. Lukituksen epäonnistuessa migraatio keskeytyy, eikä käyttöoikeuksien osittaista muutosta hyväksytä.

## Käyttöoikeuksien tarkistus

`tests/advisor-hardening.test.ts` asentaa vanhan oikean migraatioketjun, piilottaa testissä eri katalogitietoja ja kerää kunkin roolin näkyvät rivit. Uuden migraation jälkeen vertailun tulee täsmätä kaikissa kahdeksassa taulussa seuraaville:

- anonyymi käyttäjä
- authenticated-rooli ilman käyttäjätunnistetta
- tavallinen käyttäjä, jolla on asiakkaan metadataan kirjoitettu väärennetty admin-rooli
- suojatusta roolitaulusta tunnistettu admin

Lisäksi testataan admin-roolin poisto, estetty suora katalogikirjoitus, suljetut taulut, suojattu ylläpito-RPC, viiteavainindeksien kattavuus ja RLS-tapahtumatriggerin toiminta oikeuksien poiston jälkeen. Muut tietokantatestit ajavat koko uuden migraatioketjun myös ilman hallitun Supabasen tapahtumatriggeriä.

## Vuotaneiden salasanojen esto

Organisaation tilaustaso tarkistettiin Supabasen rajapinnasta: **Free**. Supabasen oma vuotaneiden salasanojen esto on [dokumentaation mukaan Pro-tason ja sitä korkeampien tilausten ominaisuus](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Sitä ei voi ottaa käyttöön nykyisellä tilauksella. Maksullista tilausta tai Auth-asetuksia ei muuteta tämän migraation yhteydessä.

## Miksi Advisorissa jää huomautuksia

Julkiselle käyttöliittymälle tarkoitetut suojatut RPC-toiminnot säilyvät käytössä. `SECURITY DEFINER` -merkintä vaatii oikeuksien ja funktion sisäisten tarkistusten arviointia, mutta ei yksin tarkoita turvatonta toimintoa. Ylläpitotoimintojen admin- ja omistajatarkistuksia ei korvata selaimen roolitiedolla.

RLS-ilman-policyä-havainnot koskevat tarkoituksellisesti suljettuja tauluja. Käyttämättömän indeksin havainto kertoo tilastosta, eikä ole itsessään riittävä peruste indeksin poistoon. Historialliset 500/521-palvelukatkon lokimerkinnät säilyvät lokissa myös palvelun palautumisen jälkeen.

## Asennus tuotantoon 2.11.2026

Migraatio `20261102165616_advisor_access_and_catalog_indexes` on asennettu projektiin
`srwfejszzzgkfqpucxjp`. Paikallinen migraatiotiedosto käyttää samaa versionumeroa kuin
Supabasen migraatiohistoria.

Asennuksen jälkeisessä Advisor-tarkistuksessa:

- `unindexed_foreign_keys`: 13 → 0
- `multiple_permissive_policies`: 8 → 0
- anonyymin SECURITY DEFINER -suoritushuomiot: 7 → 6
- kirjautuneen SECURITY DEFINER -suoritushuomiot: 42 → 41

Tuotannon metatiedot varmistavat, että selainroolit eivät voi suorittaa sisäistä
RLS-triggerifunktiota, itse tapahtumatriggeri on päällä ja kaikissa 29 public-taulussa
on RLS. Kussakin kahdeksassa katalogitaulussa on vain yksi SELECT-policy roolia kohden.
Authin terveystarkistus, kategorioiden luku, katalogihaku ja Rigin tarjonnan haku
vastasivat HTTP 200. Anonyymi ylläpitokutsu estettiin odotetulla HTTP 401 -vastauksella.

Laajempi testiajo paljasti myös vanhan hintatilastotestin kalenteripäivävirheen:
testiarvot muodostetaan nyt Helsingin päivämääristä ennen aikavyöhykemuunnosta,
jolloin kesä-/talviajan vaihto ei lisää vertailujaksoon ylimääräistä kauppaa.
Katalogitesti käyttää samoihin tarkistuksiin valmiiksi indeksoitua mallihakua.
SQL-testikantojen alustukselle annetaan kaksi minuuttia koko migraatioketjun ja
katalogiaineiston lataamiseen; varsinaiset testiehdot säilyvät ennallaan.
