# Hintavertailu ilmoituksissa

`get_listing_price_signals` laskee julkiset merkinnät palvelimella. Ilmoituspalvelu hakee ne enintään 200 tunnisteen erissä. Kortti, tietosivu ja nostokortti piilottavat merkin ilman arviota. Oletusarvoa ei ole, eikä demon tallennettuja hintatageja käytetä.

## Reilu hinta

- Vain aktiivinen FI/EUR-ilmoitus, joka on yhdistetty katalogimalliin. Kokonaisten pelikoneiden ja muiden tuotteiden yhteismalli ei riitä vertailuun.
- Sama katalogimalli, tuoteryhmä ja kunto. Myydyn vertailuilmoituksen pitää olla myyty ja moderaation puolesta näkyvä.
- Vähintään viisi palvelimella completed-tilaan vahvistettua tilausta vähintään kolmelta eri myyjältä. Arvioitavan ilmoituksen oma myyjä ei kuulu vertailuun.
- Tilaus on luotu viimeisen 90 päivän aikana (sama ajallinen lähtökohta kuin nykyisessä adminin mallihistoriassa). Tulevaisuuden tilaukset eivät kelpaa. Nykyinen skeema ei tallenna erillistä valmistumishetkeä.
- Vain FI/EUR ja `payment_provider = stripe` sekä ei-tyhjä maksun viite. Maksuintegraatio valitaan/toteutetaan myöhemmin; tämä ei luo maksuja tai luokittele testitilauksia oikeiksi kaupoiksi. Mahdolliset tulevat muut oikeat maksupalvelut tarvitsevat säännön päivityksen.
- Vertailuhinta on toteutuneiden **tuotehintojen diskreetti mediaani** (`percentile_disc(0.5)`), sentteinä. Toimitus ja palvelumaksut eivät kuulu hintaan. Tämä vähentää yksittäisten poikkeavien hintojen vaikutusta.
- Pyyntihinnan on oltava 80–110 % mediaanista, rajat mukaan lukien. Korkeammat ja poikkeuksellisen alhaiset hinnat jäävät ilman merkkiä. Nämä ovat palvelun varovainen luokittelusääntö, eivät takuu tuotteen kunnosta tai myyjän luotettavuudesta.

Julkinen RPC palauttaa vain arvioitavan julkisen ilmoituksen tunnisteen, hinnan, mallin, kunnon ja `fair`-luokituksen. Se ei paljasta yksittäisiä tilauksia, vertailuhintoja, ostajia tai yksityisiä yhteystietoja. Puuttuva/epäonnistuva haku piilottaa tagit mutta säilyttää ilmoitukset. Käyttöliittymä tarkistaa hinnan, mallin ja kunnon täsmäämisen, jotta hakuhetkien välinen muutos ei käytä vanhaa arviota. Tallennuksen jälkeen arvio lasketaan uudelleen.

Tietokannassa ei toteutushetkellä 2.11.2026 ollut tilauksia, joten merkintää ei vielä näy. Myynnissä olevien ilmoitusten pyyntihintoja, katalogin mallinimiä tai selaimessa simuloituja kauppoja ei esitetä toteutuneena markkinahintana.

## K�ytt��notto ja tietoturvarajaus

Migraatio `20261102195748_public_listing_price_signals.sql` on asennettu Supabaseen. Historiatunniste on sama paikallisesti ja palvelimella. Anonyymin k�ytt�j�n oikea tietokanta- ja REST-haku tarkistettiin: nykyiselle ilmoitukselle palautuu tyhj� vertailutulos.

Supabase Advisor huomauttaa tarkoituksellisesti julkisesta SECURITY DEFINER -funktiosta sek� anon- ett� authenticated-rooleille. T�m� lukuoperaatio tarvitsee oikeuden yksityisten tilausten aggregointiin, mutta se palauttaa vain julkisen ilmoituksen tietoja ja luokituksen. Tilausten taululuku- tai kirjoitusoikeuksia ei laajennettu. Oikea migraatioketju testataan eri k�ytt�j�rooleilla, piilotetuilla ilmoituksilla ja virheellisill� erill�.

## Ulkopuolinen data

Tarkistettu 2.11.2026: eBayn [Marketplace Insights -rajapinta](https://www.developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html) on rajoitettu eikä avoin uusille käyttäjille. Sitä ei ole liitetty projektiin. Ulkoista lähdettä ei käytetä ennen kuin saatavuus, käyttöoikeus, valuutta, kunto ja täsmällinen mallivastaavuus on varmistettu. Ei kovakoodattuja oletushintoja.
