# Evästevalikko ja selaintallennus

Ensimmäisellä käynnillä valikko näkyy kaikilla reiteillä. Sivua voi käyttää myös
tekemättä valintaa; valinnainen tallennus on oletuksena pois käytöstä.

- Vain välttämättömät: kirjautuminen ja palvelun perustoiminnot säilyvät.
- Hyväksy kaikki: sallii lisäksi nykyisen valinnaisen ominaisuuden, kielivalinnan muistamisen.
- Muokkaa asetuksia: kielivalinnan muistamisen voi valita erikseen.
- Evästeasetukset avataan tietosuojasivun tai käyttäjäasetusten painikkeesta. Kelluvaa painiketta ei näytetä valinnan jälkeen. Sulkeminen ei tallenna muutoksia.

Tässä versiossa ei ladata analytiikkaa tai markkinointiseurantaa. Valikko ei lisää
kolmannen osapuolen seurantaa. Selaimen muistissa tämän käynnin ajan oleva
katseluhistoria sekä käyttäjän erikseen tallentamat suosikit toimivat ennallaan.

`lib/cookie-consent.ts` käsittelee suostumuksen ja kielivalinnan. Valinta tallentuu
avaimelle `pc-marketplace.cookie-consent` 180 päiväksi. Muuttunut versionumero,
virheellinen tieto tai vanhentunut valinta palauttaa valinnaisen tallennuksen pois
käytöstä ja näyttää valikon uudelleen. `pc-marketplace.language` luetaan ja
tallennetaan vain kielivalinnan luvalla; luvan poistaminen poistaa tämän avaimen.
Muita avaimia tai kirjautumisistuntoa ei poisteta. Estetty tallennus ei estä käyttöä,
mutta valinta muistetaan silloin vain nykyisen sivun elinkaaren ajan.

Käyttöliittymä on `features/privacy/CookiePreferences.tsx` ja tyylit ovat
`styles/features/privacy/cookies.css`. Ylä- ja alanavigaation rakennetta ei muuteta.
Uuden valinnaisen tallennuksen tai seurantapalvelun lisääminen edellyttää sen
omaa käyttötarkoitusta vastaavaa valintaa ja lataamisen kytkemistä siihen.

Muiden E2E-kokeiden lähtötilassa on tallennettu välttämättömien valinta, jotta
ensikäynnin paneeli ei peitä testattavia painikkeita. `cookie-preferences.spec.ts`
ohittaa lähtötilan ja kattaa aidon ensikäynnin, kieltäytymisen, hyväksymisen,
muuttamisen, vanhenemisen, mobiilin ja estyneen tallennuksen.
