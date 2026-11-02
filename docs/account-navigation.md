# Profiilivalikko ja omat sivut

Kirjautuneen käyttäjän profiilikuvake avaa pienen valikon. Vanha AccountModal on
poistettu. Valikon linkit vievät profiiliin, käyttäjäasetuksiin, omiin ilmoituksiin
ja ostoksiin. Suosikit avaavat olemassa olevan suosikkinäkymän. Ylläpito ja
sisältösivut näkyvät vain Appin Auth-palvelusta saamalle admin-käyttäjälle.

Osoitteet ovat `/oma-tili`, `/oma-tili/asetukset`, `/oma-tili/ilmoitukset` ja
`/oma-tili/ostokset`. Suora käynti pyytää tarvittaessa kirjautumaan ja palauttaa
käyttäjän samalle sivulle. Uloskirjautuminen poistuu yksityiseltä sivulta.
Ilmoitukset käyttävät nykyistä käyttäjäkohtaista hakua sekä olemassa olevaa
omistajan muokkausreittiä; palvelimen tarkistuksia tai rooleja ei muuteta.

Asetuksissa voi vaihtaa kielen ja pyytää nykyisen Auth-palvelun palautuslinkin
omaan sähköpostiin. Profiilin nimi ja sähköposti ovat tässä vaiheessa lukutietoja.
Kielen tallentamiseen käytetään aiemmin toteutettua evästevalintaa.

Ostoksissa näytetään selaimen aiemmat demotilaukset vain demotilassa. Supabaseen
yhdistetyssä versiossa selaimen demotilauksia ei esitetä oikeana ostohistoriana;
oikea ostohistoria tarvitsee myöhemmän maksupalveluintegraation.

Valikko sulkeutuu ulkopuolisesta painalluksesta, reitin vaihdosta tai Escapesta.
Nuolinäppäimet sekä Home/End siirtävät kohdistusta. Escape palauttaa kohdistuksen
profiilipainikkeeseen. Kieli- ja profiilivalikot eivät ole auki yhtä aikaa.

Oman tilin sivuilla valinnat ovat työpöydällä vasemmassa sivuvalikossa allekkain. Puhelimella sama pystysuuntainen valikko siirtyy sisällön yläpuolelle. Sivupalkin Suosikit-painike avaa saman suosikkinäkymän kuin ylätunnisteen sydän ja profiilivalikko. Sulkeminen palauttaa kohdistuksen avaavaan painikkeeseen; nykyinen tilisivu säilyy.

Omien ilmoitusten yläreunassa ovat Kaikki-, Aktiiviset-, Myydyt- ja Luonnokset-suodattimet kokonaismäärineen. Aktiiviset tarkoittaa julkaistua `active`-tilaa; varatut ja poistetut ovat mukana vain Kaikki-valinnassa. Vanha demotallenne ilman tilaa tulkitaan aktiiviseksi. Supabase-haku käy kaikki omat ilmoitukset läpi 200 rivin erissä, joten määrät eivät katkea ensimmäiseen erään. Latauksen tai virheen aikana määrät näytetään viivana ja suodatus on pois käytöstä; virhettä ei esitetä tyhjänä historiana. Suodatus ei muuta ilmoitusten tilaa eikä avaa luonnoksille vielä julkaisutoimintoa.
