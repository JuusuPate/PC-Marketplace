# MVP:n rajaus

## Demossa nyt

1. Käyttäjä selaa ja suodattaa komponentteja.
2. Käyttäjä näkee standardoidun tuotetiedon, myyjän historian, toimitusmaat ja turvasignaalit.
3. Käyttäjä kirjautuu demotilille, tallentaa suosikin tai julkaisee demoilmoituksen.
4. Käyttäjä tekee demo-oston ja näkee sen omalla tilillään.
5. Admin-esikatselu näyttää markkinan tilan, valuutan ja provision.

## Ensimmäiseen oikeaan betaan

- palvelinpuolinen käyttäjätili, sähköpostin vahvistus ja salasanan palautus
- myyjäprofiili ja maksupalvelun hoitama tunnistaminen
- kuvat, EXIF-poisto, tiedostotyyppien tarkistus ja haittaohjelmaskannaus
- ilmoituksen luonnos/julkaisu/sulkeminen ja moderointijono
- haku, suodatus ja komponenttikatalogi
- checkout, maksu, myyjän tilitys ja idempotentit webhookit
- toimituksen seurantakoodi ja tilakone: paid → shipped → delivered → inspection → paid_out
- 48 tunnin tarkastusjakso, reklamaatio ja payoutin pysäytys
- kaupan jälkeen molemminpuolinen arvostelu
- raportointi, estäminen ja adminin audit-loki
- käyttäjän tietojen vienti/poisto sekä suostumus- ja säilytyskäytännöt

## Myöhemmin

- AI-hinta-arvio, toteutuneiden hintojen graafit ja PC:n arvonmääritys
- automaattiset kuljetusintegraatiot
- tarjous-toiminto ja sisäinen viestintä
- PC Builder ja yhteensopivuustarkistus
- mobiilisovellukset
- yritysmyyjät ja laajempi EU-laajennus

## Julkaisukriteeri

Oikeita maksuja ei avata ennen maksupalvelun integraatiotestejä, uhkamallinnusta, riippumatonta tietoturvakatselmointia ja juridista arviota markkinapaikan roolista, ehdoista, tietosuojasta, DSA:sta, DAC7:stä ja kuluttajansuojasta.
