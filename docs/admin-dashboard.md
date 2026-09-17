# Admin Dashboard

## Vaihe 1: suojattu yleiskatsaus

- [x] `/admin` ja sen alireitit käsitellään ylläpidon alueena; keskeneräinen alireitti näyttää suojatun ilmoituksen.
- [x] Istunnon ja palvelinpuolen admin-roolin valmistumista odotetaan ennen näkymän avaamista.
- [x] Sivupalkki sisältää yleiskatsauksen sekä linkit olemassa oleville sisältösivuille ja markkinapaikalle.
- [x] Yleiskatsaus käyttää Supabase-tietokannan yhteenvetoja ilman sovelluksen demodataa.
- [x] Lataus-, virhe-, pääsy estetty- ja nollatilat sekä manuaalinen päivitys.
- [x] Suomen-, ruotsin- ja englanninkielinen näkymä sekä mukautuva asettelu.
- [x] PostgreSQL:n käyttöoikeus- ja mittaritestit sekä sovelluksen palvelu-, näkymä- ja istuntotestit CI:ssä.

Toteutetut vaiheet ovat vain luku. Käyttäjien, ilmoitusten, raporttien tai tilausten muokkaustoimintoja ei ole vielä lisätty.

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

## Käyttöönotto

1. Suorita olemassa olevaan Supabase-projektiin `supabase/migrations/0007_admin_overview.sql` ja sen jälkeen `supabase/migrations/0008_admin_users.sql`. Uuden tietokannan kaikki migraatiot suoritetaan numerojärjestyksessä.
2. Varmista web-sovelluksen nykyiset Supabase-ympäristömuuttujat ja `user_roles`-tauluun ylläpitäjälle lisätty admin-rooli. Selaimeen tarvitaan vain julkinen avain.
3. Kirjaudu ylläpitäjän tilille ja avaa **Oma tili → Admin Dashboard** tai `/admin`.
4. Avaa `/admin/users`, tarkista haku näyttönimellä ja tunnisteella, sivutus sekä päivitys. Varmista tavallisella tilillä pääsyn estyminen.
5. Vertaa mittareita oman testitietokannan riveihin ja tarkista päivitys. Maksuintegraation puuttuessa tietokannan tilausluvut voivat olla nollia, vaikka selaimessa olisi demo-ostoja.

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

PostgreSQL-testit käyttävät PGliteä ja asentavat varsinaiset migraatiot `0001`–`0008` muuttamattomina. Supabasen tarjoamat Auth- ja Storage-taulut sekä roolit alustetaan testikohtaisessa ympäristössä. Testit kattavat anonyymin käyttäjän, tavallisen käyttäjän, puuttuvan identiteetin, väärennetyn roolimetatiedon, admin-oikeuden poistamisen, taulujen oikeudet, tyhjän datan, tilakohtaiset laskennat ja rahasummien rajaukset. Tämä ei korvaa yhdistetyn Supabase-projektin käyttöönoton tarkistamista.

## Seuraavat moduulit

Toteuta ja testaa yksi moduuli kerrallaan: Listings → Transactions → Revenue → Market Data → Reports/Disputes → Moderation → Marketing → System → Settings. Kunkin moduulin todellinen datalähde ja käyttöoikeusrajat tarkistetaan ennen toteutusta. Katalogieditori hyödyntää olemassa olevia suojattuja katalogifunktioita erillisessä vaiheessa.
