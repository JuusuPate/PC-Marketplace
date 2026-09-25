# Admin Dashboard

Koko tavoitteen ajantasainen toteutusjono ja avoimet riippuvuudet: [Rigin ylläpidon toteutusjono](admin-roadmap.md). Alla olevat vaihemerkinnät kuvaavat rajattuja toimituksia, eivät koko moduulin valmistumista.

## Vaihe 1: suojattu yleiskatsaus

- [x] `/admin` ja sen alireitit käsitellään ylläpidon alueena; keskeneräinen alireitti näyttää suojatun ilmoituksen.
- [x] Istunnon ja palvelinpuolen admin-roolin valmistumista odotetaan ennen näkymän avaamista.
- [x] Sivupalkki sisältää yleiskatsauksen sekä linkit olemassa oleville sisältösivuille ja markkinapaikalle.
- [x] Yleiskatsaus käyttää Supabase-tietokannan yhteenvetoja ilman sovelluksen demodataa.
- [x] Lataus-, virhe-, pääsy estetty- ja nollatilat sekä manuaalinen päivitys.
- [x] Suomen-, ruotsin- ja englanninkielinen näkymä sekä mukautuva asettelu.
- [x] PostgreSQL:n käyttöoikeus- ja mittaritestit sekä sovelluksen palvelu-, näkymä- ja istuntotestit CI:ssä.

Tilastonäkymät ovat vain luku. Tuotekatalogin malleja voi lisätä ja muokata. Raportteja voi ratkaista ja avata uudelleen perusteluineen. Käyttäjien, ilmoitusten tai tilausten ylläpitomuokkausta ei ole vielä lisätty.

## Vaihe 2: Users

- [x] Suojattu `/admin/users` ja käyttäjälinkki Dashboardin sivupalkissa.
- [x] Oikeat Suomen profiilit: näyttönimi, tunniste, palvelimelta tarkistettu rooli, kieli ja liittymispäivä.
- [x] Kirjainkoosta riippumaton näyttönimihaku tai tarkka käyttäjätunnistehaku; `%` ja `_` käsitellään kirjaimellisesti.
- [x] Palvelinpuolen sivutus, 25 profiilia sivulla, uusin ensin ja tunniste tasatilanteen järjestyksenä.
- [x] Suomen-, ruotsin- ja englanninkielinen näkymä, haku, päivitys, lataus-, virhe- ja tyhjätila.
- [x] Admin-roolin poistaminen estää seuraavan pyynnön ja poistaa listan näkyvistä.
- [x] Tietokanta- ja sovellustestit: yhteensä 50 testiä läpäisee.

`get_admin_users` tarkistaa oikeuden jokaisella pyynnöllä, käyttää tyhjää `search_path`-asetusta ja palauttaa vain määritellyt profiilikentät. Se ei palauta sähköposteja, Auth-metatietoja eikä muita tilitietoja. Haku rajataan 100 merkkiin ja sivunumero välille 0–1 000 000. Taulujen nykyisiä käyttöoikeuksia ei muuteta. Roolien muuttaminen, tilien sulkeminen ja yksittäisen käyttäjän kauppahistoria toteutetaan myöhemmissä vaiheissa.

Selaintarkistus yritettiin, mutta ympäristö esti paikallisen osoitteen avaamisen (`ERR_BLOCKED_BY_CLIENT`). Automaattiset näkymätestit eivät korvaa oikealla Supabase-yhteydellä tehtävää selaintarkistusta.

## Vaihe 3: Listings

- [x] Suojattu `/admin/listings` ja linkki ylläpidon sivupalkissa.
- [x] Suomen EUR-ilmoitukset kaikissa tiloissa: otsikko, tunniste, myyjän näyttönimi ja tunniste, tila, hinta sentin tarkkuudella ja luontipäivä.
- [x] Otsikkohaku sekä tarkka ilmoitus- tai myyjätunnistehaku. Merkit `%` ja `_` käsitellään kirjaimellisesti.
- [x] Tilasuodatus, 25 rivin palvelinpuolen sivutus, päivitys sekä lataus-, virhe-, pääsy estetty- ja tyhjätilat.
- [x] Suomi, ruotsi ja englanti; uusin ensin ja tunniste tasatilanteen järjestyksenä.
- [x] Käyttöoikeus-, tietokanta-, palvelu- ja näkymätestit: yhteensä 65 testiä.

`get_admin_listings` tarkistaa ylläpitäjän roolin jokaisessa pyynnössä. Se ei palauta yksityistä nouto-osoitetta, sarjanumerotodisteita, sähköposteja tai maksutietoja. Taulujen käyttöoikeuksia ei laajenneta. Vaihe on vain luku; muokkaus, poistaminen ja muut moderointitoiminnot kuuluvat myöhempään Moderation-moduuliin.

Paikalliset testit, tyyppitarkistus, muotoilutarkistus ja tuotantokäännös on ajettu. Tuotannon Supabase-migraatioita ja oikealla ylläpitäjätilillä tehtävää selaintarkistusta ei ole suoritettu tässä vaiheessa.

## Vaihe 4: Transactions

- [x] Suojattu `/admin/transactions`, tilauslista, haku ja tilasuodatus.
- [x] Ostajan ja myyjän näyttönimi sekä tunniste, tilaus- ja ilmoitustunniste, ilmoituksen nykyinen otsikko, tila ja luontiaika.
- [x] Tietokantaan tallennettu kokonaissumma sekä tuotteen, palvelumaksun, maksunkäsittelyn ja toimituksen erittely sentin tarkkuudella.
- [x] Kaikki yhdeksän tilaustilaa, 25 rivin palvelinpuolen sivutus, päivitys ja lataus-, virhe-, tyhjä- ja pääsy estetty -tilat.
- [x] Suomi, ruotsi ja englanti. Paikalliset demo-ostot on rajattu pois.

RPC `get_admin_transactions` tarkistaa admin-roolin jokaisella kutsulla. Rajaus vastaa yleiskatsauksen tilauksia: ostaja ja myyjä Suomessa, tilauksen valuutta EUR ja ilmoituksen markkina FI. Haku hyväksyy otsikon osan tai kokonaisen tilaus-, ilmoitus-, ostaja- tai myyjätunnisteen. Se ei palauta maksuviitteitä, osoitteita, sähköposteja tai toimituksen seurantatietoja eikä muuta tilauksia tai maksuja. Otsikko on ilmoituksen nykyinen otsikko; tietomalli ei sisällä erillistä ostohetken otsikkokopiota.

### Vaiheen 4 tarkistus 17.9.2026

82 automaattista testiä, tyyppitarkistus, muotoilutarkistus ja tuotantokäännös läpäisivät. Migraatio 0010 asennettiin yhdistettyyn Supabase-projektiin. Anonyymin, puuttuvan identiteetin ja ei-admin-identiteetin pääsy estettiin. Käyttäjän paikallisessa Supabaseen yhdistetyssä sovelluksessa tarkistettiin ylläpitäjän tilausnäkymä, haku, Valmis-suodatin ja tyhjä tulos. Tietokannassa ei ollut tilauksia; tietorivien summat ja sivutus tarkistettiin automaattisella testidatalla.

## Vaihe 5: Revenue

- [x] Suojattu `/admin/revenue`, vuosivalinta 2000–2100 ja 12 kuukauden erittely.
- [x] Valmiiden kauppojen määrä, tuotteiden arvo ja palvelumaksut sentin tarkkuudella sekä vuosiyhteensä.
- [x] Sama FI/EUR- ja completed-rajaus kuin yleiskatsauksessa. Hyvitykset, peruutukset ja demo-ostot eivät sisälly lukuihin.
- [x] Suomen aikavyöhykkeen vuosi- ja kuukausirajat; tyhjät kuukaudet näytetään nollina.
- [x] Suomi, ruotsi ja englanti, päivitys sekä lataus-, virhe-, tyhjä- ja pääsy estetty -tilat.

Tietomallista puuttuu valmistumisajan kenttä. Siksi erittely perustuu **tilauksen luontiaikaan** (Europe/Helsinki) ja tilauksen nykyiseen completed-tilaan. Luvut eivät kuvaa valmistumis- tai tilityskuukautta, nettovoittoa tai kirjanpidon liikevaihtoa. Toimitusta ja maksunkäsittelyä ei lasketa palvelumaksuihin tai tuotteiden arvoon. Myöhemmin hyvitetty tilaus poistuu luvuista seuraavalla päivityksellä. Palautetaan vain aggregaatteja, ei henkilötietoja tai maksujen tunnisteita.

Tarkistettu 18.9.2026: 100 testiä, tyyppitarkistus, muotoilu ja tuotantokäännös läpäisivät. Migraatio 0011 asennettiin yhdistettyyn Supabaseen. Anonyymin ja ei-admin-identiteetin pääsy estettiin. Paikallisessa sovelluksessa tarkistettiin ylläpitäjän näkymä ja vuosien 2025/2026 vaihtaminen. Oikeita valmiita kauppoja ei ollut; rahasummat, hyvitykset ja aikarajat testattiin automaattisilla tietokantatesteillä.

## Vaihe 6: Market Data

- [x] Suojattu `/admin/market-data`, tuoteryhmät katalogista ja FI/EUR-rajaus.
- [x] Aktiivisten ilmoitusten määrä ja keskimääräinen pyyntihinta; valmiiden tilausten määrä ja keskimääräinen tuotehinta koko ajalta.
- [x] Keskiarvot senttiin pyöristettyinä, havaintomäärät näkyvissä. Puuttuva hinta näytetään Ei tietoa -tekstinä, ei nollan euron hintana.
- [x] Suomi, ruotsi, englanti, päivitys sekä lataus-, virhe-, tyhjä- ja pääsy estetty -tilat.

`get_admin_market_data` tarkistaa admin-oikeuden jokaisella pyynnöllä ja palauttaa vain tuoteryhmäkohtaisia aggregaatteja. Ilmoitukset ja tilaukset aggregoidaan erikseen, jotta liitos ei monista havaintoja. Tilausten rajaus vastaa yleiskatsausta: EUR, FI-ostaja ja FI-myyjä sekä FI-ilmoitus. Kauppahinta tulee tilaukselta; nykyinen ilmoitushinta ei korvaa sitä. Hyvitetyt, perutut, keskeneräiset ja demo-ostot eivät sisälly kauppalukuihin. Toimitus ja maksut eivät sisälly tuotehintoihin.

Ryhmittely käyttää ilmoituksen nykyistä tuoteryhmää. Käytöstä poistunut tuoteryhmä säilyy raportissa, jos siinä on aktiivisia ilmoituksia tai valmiita kauppoja. Mukana ovat oman palvelun havainnot eri malleista ja kuntoluokista: tämä ei ole ulkoinen hintaseuranta tai mallikohtainen hinta-arvio. Aikasarjaa tai hintahistoriaa ei tietomallissa vielä ole.

119 automaattista testiä sekä tyyppitarkistus ja tuotantokäännös läpäisivät. Migraatio 0012 asennettiin yhdistettyyn Supabase-projektiin. Anonyymin, puuttuvan identiteetin ja ei-admin-identiteetin pääsy estettiin. Ylläpitäjän näkymä ja päivitys tarkistettiin selaimessa; oikea aineisto oli tyhjä, joten ei-nollat hinnat tarkistettiin tietokantatestien aineistolla. Paikallisen sovelluksen kaksi olemassa olevaa selaintestiä läpäisivät. Muut paikalliset muutokset ja ympäristöasetukset säilytettiin.

## Käyttöönotto

1. Suorita olemassa olevaan Supabase-projektiin `supabase/migrations/0007_admin_overview.sql` , `supabase/migrations/0008_admin_users.sql` , `supabase/migrations/0009_admin_listings.sql` , `supabase/migrations/0010_admin_transactions.sql` , `supabase/migrations/0011_admin_revenue.sql` ja `supabase/migrations/0012_admin_market_data.sql` tässä järjestyksessä. Suorita vain vielä asentamattomat migraatiot. Uuden tietokannan kaikki migraatiot suoritetaan numerojärjestyksessä.
2. Varmista web-sovelluksen nykyiset Supabase-ympäristömuuttujat ja `user_roles`-tauluun ylläpitäjälle lisätty admin-rooli. Selaimeen tarvitaan vain julkinen avain.
3. Kirjaudu ylläpitäjän tilille ja avaa **Oma tili → Admin Dashboard** tai `/admin`.
4. Avaa `/admin/users`, tarkista haku näyttönimellä ja tunnisteella, sivutus sekä päivitys. Varmista tavallisella tilillä pääsyn estyminen.
5. Avaa `/admin/listings` ja tarkista otsikko- ja tunnistehaku, kaikki tilasuodattimet, sivutus, tyhjä hakutulos ja päivitys. Varmista pääsyn esto tavallisella tilillä sekä oikeuden poistamisen jälkeen.
6. Avaa `/admin/transactions` ja tarkista haku, tilasuodatus, sivutus, päivitys ja summien erittely. Demo-ostot eivät luo rivejä listalle.
7. Avaa `/admin/revenue`, vaihda vuotta ja tarkista kuukausien ja vuosiyhteenvedon täsmäytys. Huomioi luontiaikaan perustuva ryhmittely.
8. Avaa `/admin/market-data`, tarkista tuoteryhmät, havaintomäärät, puuttuvat hinnat ja päivitys.
9. Vertaa mittareita oman testitietokannan riveihin ja tarkista päivitys. Maksuintegraation puuttuessa tietokannan tilausluvut voivat olla nollia, vaikka selaimessa olisi demo-ostoja.

GitHubin PR ei suorita migraatiota yhdistettyyn Supabase-projektiin. Käyttöönotto tarvitsee tämän erillisen tietokantavaiheen.

## Mittarien määritelmät

| Mittari                    | Tietokanta ja rajaus                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rekisteröityneet käyttäjät | `profiles.country_code = FI`; profiilirivien määrä, ei Auth-tilien eikä aktiivisten istuntojen määrä      |
| Uudet käyttäjät            | Samat profiilit, joiden `joined_at` on viimeisen seitsemän vuorokauden sisällä                            |
| Ilmoitukset                | `listings.market_country_code = FI` ja `currency = EUR`; kaikki tilat sekä erilliset tilakohtaiset määrät |
| Tilaukset                  | FI-ostaja, FI-myyjä, EUR-valuutta ja Suomen ilmoitus; kaikki tilat                                        |
| Valmiit kaupat             | Edellä rajatut tilaukset, joiden tila on `completed`                                                      |
| Riitautetut tilaukset      | Edellä rajatut tilaukset, joiden tila on `disputed`                                                       |
| Tuotteiden arvo            | Vain valmiiden tilausten `item_price_minor`-summa; toimitus- ja palvelumaksut rajataan pois               |
| Palvelumaksut              | Vain valmiiden tilausten `marketplace_fee_minor`-summa; ei nettotulos eikä kirjanpidon tuloutus           |
| Avoimet raportit           | Suomen ilmoituksiin liittyvät `reports`-rivit, joiden `resolved_at` on NULL                               |

Rahasummat palautetaan sentteinä ja näytetään kahdella desimaalilla. Palautetut, perutut ja keskeneräiset tilaukset eivät kerrytä tuotteiden arvon tai palvelumaksujen summia. Vastausta ei hyväksytä, jos luku ei mahdu JavaScriptin turvalliseksi kokonaisluvuksi.

## Käyttöoikeusraja

`get_admin_overview` on `SECURITY DEFINER` -funktio, jonka `search_path` on tyhjä ja joka tarkistaa `auth.uid()`-identiteetin sekä suojatun `user_roles`-taulun admin-oikeuden jokaisessa kutsussa. Anonyymiltä roolilta on poistettu kutsuoikeus. Tavallinen kirjautunut käyttäjä saa virhekoodin `42501`, myös silloin kun hän asettaa omiin käyttäjämetatietoihinsa admin-roolin. Oikeuden poistaminen vaikuttaa seuraavaan hakuun.

Funktio palauttaa vain aggregaatit. Se ei lisää selaimelle luku- tai kirjoitusoikeuksia käyttäjärooleihin, raportteihin tai yksittäisiin tilauksiin. Selain tyhjentää mittarit päivityksen alussa ja piilottaa näkymän istunnon tarkistuksen ajaksi; eri käyttäjä saa uuden näkymäinstanssin. Virheessä aiempia lukuja ei näytetä onnistuneen päivityksen tuloksena.

## Testaus

```bash
npm ci
npm test
npm run format:check
npm run typecheck
npm run build
```

PostgreSQL-testit käyttävät PGliteä ja asentavat varsinaiset migraatiot `0001`–`0013` muuttamattomina. Supabasen tarjoamat Auth- ja Storage-taulut sekä roolit alustetaan testikohtaisessa ympäristössä. Testit kattavat anonyymin käyttäjän, tavallisen käyttäjän, puuttuvan identiteetin, väärennetyn roolimetatiedon, admin-oikeuden poistamisen, taulujen oikeudet, tyhjän datan, tilakohtaiset laskennat ja rahasummien rajaukset. Tämä ei korvaa yhdistetyn Supabase-projektin käyttöönoton tarkistamista.

## Seuraavat moduulit

Toteuta ja testaa yksi moduuli kerrallaan: Reports/Disputes → Moderation → Marketing → System → Settings. Kunkin moduulin todellinen datalähde ja käyttöoikeusrajat tarkistetaan ennen toteutusta. Tuotemallien katalogieditori on toteutettu erillisenä `/admin/catalog`-näkymänä.

## Vaihe 7: Reports, ensimmäinen osa

`/admin/reports` näyttää Suomen markkinapaikan ilmoitusraportit ylläpitäjälle. Oletusnäkymä sisältää avoimet raportit; käsitellyt ja kaikki raportit voi valita erikseen. Otsikko- ja tunnistehaku, 25 rivin sivutus, päivitys, raportin syy, lisätiedot, ilmoituksen nykyinen tila sekä raportoijan ja myyjän näyttönimet tukevat raportin tarkistamista. Käyttöliittymä on suomeksi, ruotsiksi ja englanniksi.

`get_admin_reports` tarkistaa admin-roolin jokaisella pyynnöllä ja palauttaa vain FI/EUR-ilmoituksiin liittyvät raportit. Raporttitaulun suoraa lukuoikeutta ei anneta selaimelle. Anonyymin, tavallisen käyttäjän, puuttuvan identiteetin ja vanhentuneen admin-oikeuden pääsy estetään; palvelukerros hylkää virheelliset vastaukset. Raportin teksti näytetään Reactin tekstinä, ei HTML:nä.

Tämä ensimmäinen osa on katselujono. Raportin ratkaisu, ilmoituksen moderointi ja tilausriitojen käsittely vaativat erilliset palvelinpuolen päätös- ja auditointitoiminnot. Migraatiot `20260923165419_admin_reports_directory.sql` ja `20260923170833_secure_report_read_contract.sql` on suoritettava tässä järjestyksessä yhdistettyyn Supabase-projektiin ennen näkymän käyttöä. Jälkimmäinen poistaa vanhan suoran raporttien lukuoikeuden ja varmistaa omien raportoituja ilmoituksia koskevan RPC:n olemassaolon. GitHubiin vieminen ei asenna migraatioita.

## Tuotemallikatalogi

`/admin/catalog` sisältää muokattavan tuotemallikatalogin ja mallikohtaiset markkinatiedot. Kymmenessä tuoteryhmässä on kolme aloitusmallia (30 yhteensä). Ilmoituksen luonnin mallihaku yhdistää ilmoituksen pysyvään malliin. [Täydennysohje ja aloitussisältö](product-catalog.md). Asenna myös migraatio `0013_product_model_catalog.sql` ennen uuden sovellusversion käyttöä.

## Vaihe 7: Raporttien käsittely

Ylläpitäjä voi merkitä raportin käsitellyksi tai avata sen uudelleen. Molemmat toimet vaativat 10–2000 merkin perustelun. Viimeisin päätös, käsittelijän tunniste ja ajankohta näkyvät raportissa. Ilmoituksen tai tilauksen tila ei muutu.

Migraatio `20260923172346_admin_report_decisions.sql` lisää raportin version ja päätöslokin. `review_admin_report` tarkistaa admin-oikeuden joka kutsulla, lukitsee raportin ja hylkää vanhaan versioon kohdistuvat päätökset. Päätös ja raportin tila tallennetaan samassa transaktiossa. Selainrooleilla ei ole suoria kirjoitus- eikä lukuoikeuksia päätöslokiin; koko historia säilyy tietokannassa, käyttöliittymä näyttää viimeisimmän päätöksen. Lokin käsittelijätunniste säilyy myös tilin poistamisen jälkeen. Päätöksiä sisältävää raporttia ei voi poistaa ennen erillisen tietojen säilytyskäytännön toteuttamista.

Asenna uusi migraatio ennen tämän käyttöliittymäversion käyttöönottoa. Ilmoitusten piilottaminen ja tilausriitojen ratkaiseminen ovat edelleen erillisiä tulevia vaiheita.

## Vaihe 8: Riitautettujen tilausten katselujono

`/admin/disputes` näyttää vain nykytilaltaan riitautetut FI/EUR-tilaukset. Näkymässä on otsikko- ja tunnistehaku, 25 rivin sivutus, päivitys, osapuolet ja hintojen erittely suomeksi, ruotsiksi ja englanniksi. Suodatin välitetään nykyiselle admin-oikeuden tarkistavalle `get_admin_transactions`-funktiolle jokaisessa haussa, sivunvaihdossa ja päivityksessä. Palvelukerros hylkää muun tilan sisältävän vastauksen. Tilaukset-näkymän kaikki tilasuodattimet säilyvät.

Päivämäärä on tilauksen luontiaika, koska riitautuksen ajankohtaa ei tallenneta erikseen. Riidan syy, viestit, todistusaineisto ja ratkaisu-/hyvitystoiminnot puuttuvat vielä tietomallista. Näkymä ei muuta tilauksia eikä maksuja. Se käyttää jo asennettua tilausrajapintaa eikä tarvitse uutta migraatiota.

## Vaihe 9: aikavertailu, tarkemmat tiedot ja tapahtumaloki

Yleiskatsauksen Vaatii huomiota -linkit avaavat avoimet raportit ja riitautetut tilaukset. Aikavertailu näyttää rekisteröinnit, ilmoitusten ja tilausten luonnit sekä valittuna aikana luotujen, nykytilaltaan valmiiden tilausten tuotearvon ja palvelumaksut. Valinnat ovat 24 tuntia, 7/30/90/365 päivää tai oma enintään 366 päivän UTC-aikaväli. Tulosten päivämäärät esitetään Suomen ajassa. Rajat ovat alku mukaan lukien ja loppu pois lukien. Vertailujakso on välittömästi edeltävä samanpituinen jakso; muutos esitetään lukuna, joten nollavertailu ei tuota harhaanjohtavaa prosenttia.

Käyttäjän Avaa tiedot -painike hakee erikseen sähköpostin, Suomen ilmoitusmäärän, valmiit myynnit/ostot, avoimet riidat ja 25 uusinta tilausta. Tilaus- ja riitajonoissa painike näyttää tallennetun maksupalvelun ja viitteen, tarkastusajan sekä mahdolliset toimitustiedot. Tietoja ei muuteta, maksuviite ei vahvista maksua eikä puuttuva toimitus ole vahvistettu lähettämättömäksi tilaukseksi. Yksityisiä nouto-osoitteita tai Auth-metatietoja ei palauteta.

`/admin/audit` yhdistää katalogimuutokset ja raporttien käsittelypäätökset. Haku tukee kohteen, tekijän ja tapahtuman tarkkaa tunnistetta sekä kohdetyyppiä/toimintoa. Sivutus on 25 tapahtumaa. Ennen/jälkeen-tiedot ja tallennettu perustelu ovat luettavissa; lokia ei voi muuttaa tämän käyttöliittymän kautta. Näkymä ei väitä sisältävänsä vielä kirjaamattomia toimintoja.

Asenna `20260924175915_admin_activity_and_audit.sql` ja `20260924181012_admin_detail_views.sql` ennen uuden version käyttöönottoa. Ne lisäävät neljä ylläpitäjän vain luku -RPC:tä; taulujen selainoikeudet pysyvät ennallaan. Jokainen pyyntö tarkistaa identiteetin ja palvelinpuolen admin-roolin. Virhe tai oikeuden menetys tyhjentää aiemmin näytetyt tiedot.

Paikallisesti 24.9.2026: 175 automaattista testiä, tyyppitarkistus, tuotantokäännös ja kaikki seitsemän selaintestiä läpäisivät. Näistä kolme uutta selaintestiä kattaa aikavälin vaihdon, lokin haun/sivutuksen ja yksityistietojen poistumisen oikeuden menetyksessä. Migraatioiden etäasennus ja oikean palvelun selaintarkistus varmistetaan erikseen käyttöönotossa.

Paikallinen puuttuvan ylläpitosivun virhe johtui portissa 4173 ajetusta vanhasta `Documents/Github/PC-Marketplace`-kopiosta, joka on sittemmin poistettu. Oikean `OneDrive/Tiedostot/ChatGPT/PC-Marketplace`-kopion käynnistäminen samaan porttiin korjasi `/admin/disputes`-sivun. Varmista aina palvelimen todellinen projektikansio, älä pelkkää porttia.

## Vaihe 10: ilmoituksen moderointi

`/admin/listings` tarjoaa aktiivisen FI/EUR-ilmoituksen piilottamisen ja moderoinnissa piilotetun ilmoituksen palauttamisen. Päätökselle vaaditaan 10–2000 merkin perustelu. Piilotettu ilmoitus poistuu julkisesta hausta; myyjä näkee sen edelleen omassa tilissään. Palautus on sallittu vain ylläpidon piilottamalle ilmoitukselle. Käynnissä oleva tilaus estää piilottamisen, jotta tilauksen käsittely ei muutu ilmoituksen mukana.

`20260925135653_listing_moderation.sql` lisää tilaversion ja erillisen päätöslokin. `moderate_admin_listing` tarkistaa suojatun admin-roolin jokaisella pyynnöllä, lukitsee ilmoituksen ja hylkää vanhentuneen päätöksen. Tilan muutos ja lokimerkintä tallentuvat samassa tietokantatapahtumassa. Päätökset näkyvät tapahtumalokissa; selaimelle ei avata suoria kirjoitusoikeuksia ilmoitustauluun tai päätöslokiin.

Asenna migraatio Supabase-projektiin ennen uuden käyttöliittymäversion käyttöönottoa. Tämä ei vielä sisällä käyttäjäsanktioita, duplikaattitunnistusta tai automaattista riskipisteytystä.
