# Ilmoituslomakkeiden hybridimalli

Ilmoituksen luonti käyttää yhtä vaiheistettua lomaketta ja kategoriakohtaisia kenttiä. Vaiheet ovat kategoria, tuote ja hinta, tekniset tiedot ja kuvaus, kuvat, sijainti sekä tarkistus. Kuviin, yksityiseen nouto-osoitteeseen ja julkaisuoikeuksiin sovelletaan edelleen nykyisiä palvelinrajapintoja.

## Katalogi ja vapaa täydentäminen

- **Näytönohjain:** valitse katalogista piirimalli ja muistiversio. Täydennä erikseen kortin valmistaja ja versio, esimerkiksi MSI + Gaming X Trio. Ne eivät poista perusmallin katalogiviitettä. Piirimallin tai sen teknisten tietojen muuttaminen irrottaa viitteen, jotta vanhaan malliin ei liitetä väärää tuotetta. Ilman katalogia tiedot voi antaa käsin.
- **RAM:** kokonaiskapasiteetti, DDR-tyyppi, moduulien määrä, moduulin kapasiteetti, DIMM/SO-DIMM, nopeus ja CAS-viive. Merkki ja mallisarja ovat vapaaehtoisia. Osanumeroa ei tarvita. Tarkan katalogimallin voi halutessaan valita avattavasta katalogihausta. Ristiriitainen kokonaiskapasiteetti ja moduulijako estävät jatkamisen.
- **Tallennuslaite:** kapasiteetti, laitetyyppi, koko, liitäntä ja PCIe-sukupolvi. Merkki ja malli täydentävät ominaisuuksia.
- **Prosessori, emolevy, virtalähde, kotelo, jäähdytin ja tuuletin:** oma kenttäjoukko, mallihaku ja käsinsyöttö. Esimerkiksi kotelolla kokostandardi, kotelotyyppi ja väri; virtalähteellä teho, hyötysuhde ja kokostandardi.
- **Muut tuotteet:** merkki, malli, vapaat lisätiedot ja kuvaus.

Katalogihäiriö ei estä käsinsyöttöä. RAMin olemassa olevia katalogimalleja ja ilmoitusviitteitä ei poisteta eikä eri muistiversioiden markkinahintoja yhdistetä. Ominaisuuksilla ilmoitettu tuote ilman mallivalintaa jää mallikohtaisen hinta-aggregaatin ulkopuolelle.

## Pelikone ja keskeneräinen kokoonpano

Komponenttilista kattaa prosessorin, näytönohjaimen, RAMin, tallennuslaitteet, emolevyn, virtalähteen, kotelon, jäähdytyksen, kotelotuulettimet ja käyttöjärjestelmän. Anna kullekin tiedot tai merkitse **Puuttuu / ei mukana** tai **En tiedä**. Mukana olevalle osalle tarvitaan kuvaus; RAMille riittää myös kokonaiskapasiteetti. Osien katalogihaku täydentää komponentin tekstiä, eikä osan hinta sekoitu koko koneen markkinahintaan.

Puuttuvan tai tuntemattoman osan aiempi teksti ei päädy tallennukseen tai automaattiseen otsikkoon. Puuttuvat osat näytetään myös ostajan tietosivulla. Useat levyt ja lisäosat voidaan eritellä kyseisen osan tekstikentässä. Muistin määrän, tyypin, moduulien ja nopeuden voi antaa erikseen.

## Otsikko ja RGB

Uuden ilmoituksen otsikko päivittyy tietojen mukana. Esimerkiksi `MSI Gaming X Trio GeForce RTX 3080 10 GB` tai `Kingston Fury Beast 32 GB (2×16 GB) DDR4 3200 MHz CL16`. Otsikon kirjoittaminen käsin siirtää sen omaan hallintaan. Automaation saa takaisin valinnalla **Muodosta otsikko automaattisesti**. Olemassa olevan ilmoituksen otsikko säilyy muokkauksessa oletusarvoisesti ennallaan. Pituus on enintään 100 merkkiä.

Pelikoneella ja tuulettimella on **RGB-valaistus**-valinta. Myös ARGB kuuluu RGB-tagiin. Tuulettimen tarkka valaistustyyppi säilyy erikseen; sen muuttaminen päivittää tagin. RGB näkyy ilmoituskortilla ja tietosivulla ja on haettavissa sivupalkin **RGB-valaistus (myös ARGB)** -valinnalla. Tagia ei päätellä otsikosta.

## Tietojen tallennus ja yhteensopivuus

Uudet tiedot tallennetaan nykyiseen `listings.specs`-JSONB-kenttään vakioavaimina ja merkkijonoarvoina: esimerkiksi `brand`, `model`, `coreModel`, `capacity`, `memoryType`, `modules`, `moduleCapacity`, `speed`, `latency` ja `rgb`. Pelikone käyttää komponenttiavaimia kuten `processor` sekä tilaa `componentStatus_processor` (`included`, `missing`, `unknown`). RAMin tietoja ovat `pcMemoryCapacity`, `pcMemoryType`, `pcMemoryModules` ja `pcMemorySpeed`.

Vanhoja suomeksi tai muilla käyttöliittymän kielillä nimettyjä kenttiä luetaan edelleen. Muokkaus tallentaa tunnetut kentät vakioavaimilla; ostajalle näytetään kieliversion mukaiset otsikot. Nykyinen `catalog_model_id`, omistajuuden tarkistavat create/update-RPC:t ja RLS säilyvät. Tämä uudistus ei vaadi uutta Supabase-migraatiota. Komponentin tiedot ovat myyjän ilmoittamia; lomake ei tee yhteensopivuus- tai toimivuusvarmennusta.

Toteutuksen omistajat: `features/sell/specification-fields.ts` (kentät), `listing-profile.ts` (otsikot, tallennus ja yhteensopivuus), `ProfileFields.tsx` (kentät ja komponenttilista) sekä `styles/features/sell/listing-profile.css` (asettelu). Älä lisää yleistä global.css-tiedostoa.
