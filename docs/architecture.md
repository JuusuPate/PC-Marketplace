# Arkkitehtuuri: Finland-first, Nordic-ready

## Periaate

Suomi on ensimmäinen markkina, ei järjestelmän kiinteä oletus. Sama domain-malli, komponenttitietokanta ja kaupankäyntiketju palvelevat kaikkia markkinoita.

Nykyinen julkaisurajaus on kuitenkin yksiselitteisesti Suomi: julkisessa käyttöliittymässä on vain `FI`, `EUR` ja toimitus Suomessa. Muut markkinat ovat mallinnettuja laajennuskohteita, eivät avattuja markkinoita.

```text
Web / myöhemmin mobiili ja admin
          │
Marketplace core
├── käyttäjät ja julkiset myyjäprofiilit
├── komponenttikatalogi ja ilmoitukset
├── tilaukset, toimitukset ja tarkastusjakso
├── arvostelut, raportit ja riidat
└── hintadata ja markkinasignaalit
          │
Market configuration
├── FI · fi · EUR · Posti / Matkahuolto
├── SE · sv · SEK · PostNord / DB Schenker
├── DK · da · DKK · PostNord / DAO
└── NO · nb · NOK · Posten / Bring
```

## Kansainvälistämisen säännöt

- Raha tallennetaan kokonaislukuna pienimmässä rahayksikössä (`price_minor = 48900`, `currency = EUR`).
- Maat tallennetaan ISO 3166-1 alpha-2 -koodeina (`FI`, `SE`, `DK`, `NO`).
- Kielet käyttävät BCP 47 -yhteensopivia koodeja (`fi`, `sv`, `da`, `nb`, `en`).
- Käyttöliittymäteksti tulee kieliavaimista eikä liiketoimintalogiikasta.
- Ilmoituksella on myyjän maa, alkuperäinen valuutta ja erillinen `ships_to`-joukko.
- Tilaukselle tallennetaan ostohetken hinnat, valuutta, markkina, ostajan maa ja myyjän maa. Historiatietoja ei lasketa myöhemmin muuttuvista asetuksista.
- Markkinakohtaiset palvelumaksut, toimitustavat ja saatavuus ovat konfiguraatiota.
- Norja pidetään omana markkinanaan, koska se ei kuulu EU:n ALV- ja kuluttajakehykseen samalla tavalla kuin FI/SE/DK.

## Tuotantoon johtava tavoiterakenne

```text
apps/
├── web/             # ostajan ja myyjän palvelu
└── admin/           # myöhemmin eriytetty valvonta ja operaatiot
packages/
├── domain/          # yhteiset skeemat, säännöt ja tapahtumat
├── i18n/            # jaetut käännökset ja locale-työkalut
├── market-config/   # maat, valuutat, maksut ja toimituskumppanit
└── ui/              # jaettu design system
supabase/
└── migrations/      # Postgres-skeema ja RLS-käytännöt
```

Nykyisessä demossa jaettava koodi on vielä web-sovelluksen sisällä. Se irrotetaan `packages`-hakemistoon vasta, kun toinen kuluttaja (admin tai mobiili) todella tarvitsee sen. Näin pohja säilyy selkeänä ilman ennenaikaista monimutkaisuutta.

## Turvarajat

Selain ei saa päättää käyttäjän oikeuksista, tilauksen tilasta, maksun onnistumisesta tai payoutista. Tuotannossa jokainen tällainen muutos tehdään palvelinpuolella, todennetaan maksupalvelun allekirjoitetusta webhookista ja tallennetaan muuttumattomaan audit-lokiin.

Selaimeen ei tallenneta salasanoja, KYC-aineistoa, henkilötunnuksia, maksukorttitietoja tai DAC7-raportointiaineistoa. Demon localStorage on vain käyttöliittymäprototyyppi.

## Nykyinen palvelinyhteys

Web-sovellus valitsee käynnistyksessä toimintatilan ympäristömuuttujien perusteella:

- `demo`: istunto, ilmoitukset, suosikit ja tilaukset säilyvät vain selaimessa
- `supabase`: autentikointi ja käyttäjän julkaisemien ilmoitusten tallennus käyttävät Supabasea; muut virrat säilyvät vielä demona

Selain käyttää vain Supabasen julkista publishable key -avainta. Tietokanta luo profiilin Auth-käyttäjälle triggerillä. RLS-käytännöt ja erikseen rajatut tauluoikeudet suojaavat selaimelle näkyvän datan, eikä selain saa suoraa kirjoitusoikeutta profiili- tai ilmoitustauluihin. Ilmoitus ja toimitusmaat luodaan yhdessä tarkastetussa tietokantafunktiossa, jolloin osittain tallentunutta ilmoitusta ei synny.

Migraatio `0003_finland_only_launch.sql` asettaa muut markkinat pois käytöstä ja estää tietokantatasolla muiden maiden profiilit, julkaistut ilmoitukset sekä toimitusmaat. Kun seuraava maa avataan, selainkonfiguraatio ja tämä tietokantaraja päivitetään samassa versioidussa muutoksessa.

## Hallittava katalogi

Migraatio `0006_catalog_taxonomy.sql` siirtää kategoriarakenteen hallittavaksi dataksi ilman erillistä taulua jokaiselle komponenttityypille:

- `catalog_categories` kuvaa myytävät kategoriat ja mahdolliset ryhmät. Nykyinen `listings.category` viittaa kategorian vakaaseen `slug`-arvoon.
- `catalog_market_categories` ottaa kategorian käyttöön tietyllä markkinalla ja määrittää sen järjestyksen. Julkinen luku palauttaa toistaiseksi vain käytössä olevat Suomen rivit.
- `catalog_navigation_items` sisältää kategoriapalkin markkinakohtaiset alasvetovalinnat. Suodatin tallennetaan rajattuna JSON-konfiguraationa, ei suoritettavana SQL:nä tai adminin antamana URL-osoitteena.
- `catalog_brands` ja `catalog_category_brands` rajaavat brändit niihin kategorioihin, joissa ne ovat käyttökelpoisia.
- `catalog_spec_fields` ja `catalog_category_spec_fields` määrittävät kategoriakohtaiset tekniset kentät, järjestyksen, pakollisuuden ja mahdollisuuden valita ”en tiedä”. Kentillä on käännöksistä riippumattomat vakaat avaimet.

GPU:n NVIDIA/AMD-rajaus mallinnetaan `gpu_chip_vendor`-teknisenä valintana. Se pidetään erillään varsinaisesta tuotemerkistä, koska esimerkiksi NVIDIA-piiriä käyttävän kortin tuotemerkki voi olla ASUS ja AMD-piiriä käyttävän Sapphire.

Nykyiset ilmoitukset säilyttävät vielä tekniset tiedot vapaamuotoisessa `listings.specs`-JSON:ssa, ja selainversio voi käyttää vanhoissa riveissä lokalisoituja avaimia. Seuraava taaksepäin yhteensopiva vaihe on kirjoittaa uusille ilmoituksille rinnalle vakaat kenttäavaimet ja lukea siirtymän aikana molempia muotoja.

Kaikki käyttäjälle näytettävät katalogin nimet tallennetaan `labels`-JSONB-kenttään kieliavaimilla `fi`, `sv`, `da`, `nb` ja `en`. Suomenkielinen nimi on pakollinen; muut kielet voidaan täydentää ennen kunkin markkinan avaamista.

Anonyymi ja tavallinen kirjautunut käyttäjä saavat vain aktiivisen Suomen katalogin lukuoikeuden. Selainrooleilla ei ole suoraa kirjoitusoikeutta katalogitauluihin. Ensimmäinen rajattu admin-toiminto, navigaatiovalinnan tallennus, kulkee `save_catalog_navigation_item`-funktion kautta; se tarkistaa `user_roles`-taulun admin-roolin, hyväksyy vain ennalta määritetyt suodatintyypit ja tallentaa muutoksen `catalog_admin_changes`-audit-lokiin. Nostetun ilmoituksen tilan voi muuttaa vain vastaavasti suojatulla `set_listing_featured`-funktiolla. Tulevat kategoria-, brändi- ja kenttäeditorit käyttävät samaa RPC-, validointi- ja auditointimallia. Kohdat poistetaan näkyvistä `is_active`- tai `is_enabled`-lipulla, jotta vanhojen ilmoitusten viitteet säilyvät.
