# Rigin ylläpidon toteutusjono

Lähde: käyttäjän nimeämä keskustelu **Rigin admin dashboardin sisältö**. Tämä jono erottaa toteutetun toiminnallisuuden koko tavoitteen valmistumisesta. Pelkkä sivu tai tyhjä tietokantataulu ei tee moduulista valmista.

## V1 – operatiivinen ylläpito

| Järjestys | Kokonaisuus | Toteutettu                                                                                                                                            | Jäljellä                                                                                                                                                                                            |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Overview    | FI/EUR-yhteenvedot, avoimien raporttien ja riitojen linkit, 24 h / 7 / 30 / 90 / 365 vrk ja oma UTC-aikaväli, edeltävän samanpituisen jakson vertailu | Aktiivisuusmittaus; maksuvirhe-, KYC-, tilitys- ja toimitushälytysten tapahtumalähteet ja määräajat.                                                                                                |
| 2         | Users       | Suojattu hakemisto, sähköposti erikseen avattavassa tietonäkymässä, ilmoitus- ja kauppamäärät, 25 uusinta tilausta                                    | Viimeisin kirjautuminen, arvostelut, muistiinpanot, vahvistukset, varoitukset ja sanktiot sekä niiden palvelinpuolinen valvonta. Täysi käyttäjä-360 ei ole valmis.                                  |
| 3         | Listings    | Haku, tila, myyjä, hinnat ja sivutus                                                                                                                  | Kategoria-/hinta-/päivärajaukset, muutoshistoria, moderointipäätökset.                                                                                                                              |
| 4         | Orders      | Hakemisto, osapuolet, tila, rahojen erittely, tallennettu maksuviite, seurantatunnus, lähetys-/toimitusajat ja tarkastusajan päättyminen              | Tapahtumahistoria, tilasiirtymät, kuljetuspalvelun integraatio ja palautukset. Tietokantamerkintä ei vahvista maksua tai toimitusta palveluntarjoajalta.                                            |
| 5         | Payments    | Tietokantaan tallennetun maksupalvelun ja viitteen katselu tilauksessa                                                                                | **Stripe valitaan myöhemmin käyttäjän päätöksen mukaisesti 24.9.2026.** Testitili, Connect/onboarding, allekirjoitetut webhookit, idempotentit maksut/tilitykset/hyvitykset ja täsmäytys puuttuvat. |
| 6         | Reports     | Haku, suodatus, ratkaisu/uudelleenavaus perusteluineen ja versiontarkistus, päätöshistoria                                                            | Käyttäjäraportit ja ilmoituksen moderointi.                                                                                                                                                         |
| 7         | Disputes    | Riitautettujen tilausten hakemisto, osapuolet, rahojen erittely ja toimitustiedot                                                                     | Riidan avaaminen, syyt, aikajana, todisteet, lausunnot ja käsittely. Rahaliikenne odottaa Stripeä.                                                                                                  |
| 8         | Audit log   | Katalogimuutosten ja raporttipäätösten haku/sivutus; tekijä, aika, kohde, ennen/jälkeen ja olemassa oleva perustelu. Ei muokkausta tai poistoa.       | Uusien toimintojen kytkeminen lokiin. Vanhoilla katalogitapahtumilla ei ole tallennettua perustelua.                                                                                                |

## V2 – laajennukset

1. **Analytics:** luontiaikaan perustuva aikavertailu on toteutettu. Kävijä-/käyttötapahtumia ei vielä kerätä; aktiivisuutta tai konversiota ei voi päätellä nolliksi.
2. **Finance:** nykyinen vuosi-/kuukausiyhteenveto näyttää nykytilaltaan valmiiden tilausten tuotearvon ja palvelumaksut. Kirjanpidon tapahtumakirja, hyvitykset, chargebackit, kulujen täsmäytys, ALV-erittely, tilitykset ja vienti puuttuvat. Rahaliikenteen integraatio on ensin toteutettava.
3. **Moderation:** raportin käsittely on käytössä; ilmoituksen moderointi, sanktiot, duplikaatit ja ihmisen tarkistamat riskisignaalit puuttuvat.
4. **DAC7:** alkuperäinen ehdotus edellyttää oikeudellisesti varmennettua määrittelyä ennen raportointilogiikkaa. Raportointivuoden, myyjän tunnistamisen, soveltamisalan, kynnysten ja henkilötietojen säilytyksen määrittely puuttuu.
5. **Support:** tiketit, osapuolten viestit, ylläpidon vastaukset ja käyttöoikeusrajat puuttuvat.
6. **Marketing:** kampanjat, kupongit, kumppanuus- ja mainoslogiikka puuttuvat. Kuponkien rahavaikutus sidotaan palvelinpuolen kassaan.
7. **Notifications:** palvelinpuolen toimitusjono, käyttäjäasetukset, toimitustila, uudelleenyritykset ja sähköpostipalvelu puuttuvat.

## V3 – analyysi ja järjestelmän hallinta

1. **Fraud detection:** riskisignaalit tarvitsevat datan, dokumentoidut säännöt ja ihmisen tarkistuksen. Ei automaattisia sanktioita.
2. **Component market data:** katalogi ja oman palvelun mallikohtaiset määrä-/keskiarvohintatiedot ovat käytössä. Mediaanit, myyntiajat ja 7 päivän muutokset puuttuvat.
3. **Price index:** tarvitsee historiallisen havaintoaineiston ja määritellyn laskentamenetelmän; nykyiset ilmoitushinnat eivät ole historiaa.
4. **Seller analytics:** käyttäjän valmiiden myyntien määrä ja viimeisimmät tilaukset ovat käytössä. Myyntinopeus, peruutus-/riitaosuudet ja vertailut puuttuvat.
5. **Conversion funnels:** tarvitsee yhteisesti määritellyt tapahtumat ja mittauksen kävijästä valmistuneeseen tilaukseen.
6. **Cohort/retention:** tarvitsee käyttöaktiivisuuden historian; rekisteröintipäivä ei osoita paluuta palveluun.
7. **Feature flags:** palvelinpuolen hallinta, auditointi ja kunkin ominaisuuden todellinen käyttökohde puuttuvat.
8. **System monitoring:** virhe-, ajastus-, integraatio- ja viivetiedot sekä hälytyskynnykset puuttuvat. Staattista vihreää tilaa ei näytetä.

## Yhteiset vaatimukset

- Nykyiset roolit ovat `admin` ja `user`. Superadmin/moderator/support/finance/analyst vaativat tehtäväkohtaisen palvelinpuolisen oikeusmallin.
- Yleishaku eri kohdetyypeistä puuttuu; nykyiset hakemistot tukevat oman kohteensa tunniste- ja tekstihakua.
- Tietokannan muutokset tehdään uusilla migraatioilla. Paikalliset testit eivät todista asennusta yhdistettyyn Supabaseen.
- Käyttäjän neljä paikallista katalogimuutosta ja ympäristötiedostot säilytetään erillään tästä toteutuksesta.

## Tämän lisäyksen tarkistus

Migraatiot `20260924175915_admin_activity_and_audit.sql` ja `20260924181012_admin_detail_views.sql` lisäävät neljä vain luku -RPC:tä. Kaikki tarkistavat identiteetin ja suojatun admin-roolin joka kutsulla; eivät laajenna taulujen selainoikeuksia. Lukeminen ei muuta maksuja, tilauksia tai käyttäjiä.

Paikallisesti tarkistettu: 174 Vitest-testiä (koko migraatioketju PGlitessä), tyyppitarkistus ja kolme uutta selaintestiä. Selaintesteissä vain RPC-kuljetus on korvattu testivastauksilla; varsinaiset komponentit ja palvelukerrokset suoritetaan. Katso käyttöönottotilanne [ylläpidon dokumentista](admin-dashboard.md).
