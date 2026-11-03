# Profiilivalikko ja omat sivut

Kirjautuneen käyttäjän profiilikuvake avaa pienen valikon. Vanha AccountModal on
poistettu. Valikon linkit vievät profiiliin, käyttäjäasetuksiin, omiin ilmoituksiin
ja ostoksiin. Suosikit avautuu saman tilikokonaisuuden sisälle. Ylläpito ja
sisältösivut näkyvät vain Appin Auth-palvelusta saamalle admin-käyttäjälle.

Osoitteet ovat `/oma-tili`, `/oma-tili/asetukset`, `/oma-tili/ilmoitukset`,
`/oma-tili/ostokset` ja `/oma-tili/suosikit`. Suora käynti pyytää tarvittaessa kirjautumaan ja palauttaa
käyttäjän samalle sivulle. Uloskirjautuminen poistuu yksityiseltä sivulta.
Ilmoitukset käyttävät nykyistä käyttäjäkohtaista hakua sekä olemassa olevaa
omistajan muokkausreittiä; palvelimen tarkistuksia tai rooleja ei muuteta.

Asetuksissa voi vaihtaa kielen ja pyytää nykyisen Auth-palvelun palautuslinkin
omaan sähköpostiin. Profiilissa voi muokata julkista nimeä, vaihtaa profiilikuvaa ja pyytää sähköpostiosoitteen vaihtoa.
Kielen tallentamiseen käytetään aiemmin toteutettua evästevalintaa.

Ostoksissa näytetään selaimen aiemmat demotilaukset vain demotilassa. Supabaseen
yhdistetyssä versiossa selaimen demotilauksia ei esitetä oikeana ostohistoriana;
oikea ostohistoria tarvitsee myöhemmän maksupalveluintegraation.

Valikko sulkeutuu ulkopuolisesta painalluksesta, reitin vaihdosta tai Escapesta.
Nuolinäppäimet sekä Home/End siirtävät kohdistusta. Escape palauttaa kohdistuksen
profiilipainikkeeseen. Kieli- ja profiilivalikot eivät ole auki yhtä aikaa.

Oman tilin sivuilla valinnat ovat työpöydällä vasemmassa sivuvalikossa allekkain. Puhelimella sama pystysuuntainen valikko siirtyy sisällön yläpuolelle. Järjestys alkaa Profiili, Omat ilmoitukset ja Suosikit. Ostokseni ja Käyttäjäasetukset säilyvät niiden jälkeen. Sivupalkin Suosikit-linkki, ylätunnisteen sydän ja profiilivalikko vievät kaikki `/oma-tili/suosikit`-sivulle. Suosikeilla ei ole enää ponnahdusikkunaa. Kirjautumaton käyttäjä palautetaan kirjautumisen jälkeen suosikkeihin.

Omien ilmoitusten yläreunassa ovat Kaikki-, Aktiiviset-, Myydyt- ja Luonnokset-suodattimet kokonaismäärineen. Aktiiviset tarkoittaa julkaistua `active`-tilaa; varatut ja poistetut ovat mukana vain Kaikki-valinnassa. Vanha demotallenne ilman tilaa tulkitaan aktiiviseksi. Supabase-haku käy kaikki omat ilmoitukset läpi 200 rivin erissä, joten määrät eivät katkea ensimmäiseen erään. Latauksen tai virheen aikana määrät näytetään viivana ja suodatus on pois käytöstä; virhettä ei esitetä tyhjänä historiana. Suodatus ei muuta ilmoitusten tilaa eikä avaa luonnoksille vielä julkaisutoimintoa.

## Profiilin tallennus

Nimen (2–60 merkkiä) ja julkisen profiilikuvan tallennus käyttää Supabase Authin `updateUser`-toimintoa. Auth-taulun suojattu triggeri päivittää atomisesti vain `profiles.display_name`- ja `profiles.avatar_path`-kentät. Käyttäjän metadata ei myönnä ylläpito-oikeuksia. Julkiset ilmoitukset lukevat nimen ja kuvan profiles-taulusta. Kuvan saa vaihtaa vain omaan `profile-avatars`-tallennustilan polkuun ladattuun WebP-tiedostoon.

Kuvat käsitellään olemassa olevalla kuvaputkella (JPG/PNG/WebP, lähde enintään 10 Mt, uudelleenpakkaus WebP:ksi, selaimen metatiedot eivät siirry). Uusi tiedosto ladataan ensin. Vanha kuva poistetaan vasta onnistuneen profiilitallennuksen jälkeen. Tallennustilan säännöt estävät aktiivisen kuvan poistamisen ja toisten käyttäjien polkuihin kirjoittamisen. Epäonnistunut tiedostosiivous ei peruuta onnistunutta profiilia.

Sähköpostin vaihto käyttää Authin omaa vahvistusmenettelyä ja palautusosoitetta profiilisivulle. Osoitetta ei tallenneta julkiseen profiiliin eikä käyttöliittymä vaihda kirjautumisosoitetta ennen Authin vahvistusta. Palvelin määrittää tarvittavat vahvistukset. Demossa nimen, kuvan ja sähköpostin muokkaus tallennetaan vain selaimeen; se ei lähetä sähköpostia.

Palvelinasennus on tarkistettu Supabasessa 3.11.2026: migraatio `20261103075912_editable_public_profiles` on asennettu, profiilikuvien tallennustila ja omistajakohtaiset säännöt ovat käytössä ja Auth-triggeri on aktiivinen. Käyttöliittymä ja tallennuspalvelu tarkistavat `get_profile_editing_enabled`-valmiusmerkin, joka palauttaa nyt true. Sähköpostin vaihtopyyntö käyttää olemassa olevaa Auth-palvelua ja toimii tästä erillään.
