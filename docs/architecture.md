# Arkkitehtuuri: Finland-first, Nordic-ready

## Periaate

Suomi on ensimmäinen markkina, ei järjestelmän kiinteä oletus. Sama domain-malli, komponenttitietokanta ja kaupankäyntiketju palvelevat kaikkia markkinoita.

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
