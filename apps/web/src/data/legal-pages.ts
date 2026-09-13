import type { LegalPageContent, LegalPageSlug, Locale } from "../types";

type LegalPageDraft = Omit<LegalPageContent, "slug" | "locale" | "updatedAt">;

const finnishPages: Record<LegalPageSlug, LegalPageDraft> = {
  terms: {
    title: "Käyttöehdot",
    summary:
      "Nämä käyttöehdot ovat PC Marketin demoversion luonnos. Sisältö tarkistetaan ja täydennetään ennen palvelun varsinaista julkaisua.",
    body: `## 1. Palvelun tarkoitus
PC Market on Suomessa toimiva tietokoneiden, komponenttien ja oheislaitteiden markkinapaikka. Palvelu auttaa käyttäjiä julkaisemaan ilmoituksia sekä löytämään tuotteita muilta käyttäjiltä.

## 2. Käyttäjätili
Käyttäjä vastaa antamiensa tietojen oikeellisuudesta, tilinsä turvallisuudesta ja kaikesta tilillään tapahtuvasta toiminnasta. Tiliä ei saa käyttää lainvastaiseen tai muita käyttäjiä vahingoittavaan toimintaan.

## 3. Ilmoitukset
Myyjä vastaa siitä, että ilmoituksen kuvaus, kuvat, kunto, hinta ja muut tuotetiedot ovat paikkansapitäviä. Palvelussa ei saa myydä varastettuja, laittomia, vaarallisia tai tekijänoikeuksia loukkaavia tuotteita.

## 4. Kaupankäynti
Ostaja ja myyjä vastaavat tekemänsä kaupan tiedoista ja sovituista toimitusehdoista. Demoversio ei käsittele oikeita maksuja, eikä demossa tehty ostotapahtuma muodosta oikeaa kauppaa.

## 5. Sisällön valvonta
PC Market voi poistaa sääntöjen vastaisia ilmoituksia, rajoittaa tilin käyttöä ja pyytää käyttäjältä lisätietoja palvelun turvallisuuden varmistamiseksi.

## 6. Vastuu ja ehtojen muutokset
Palvelua kehitetään jatkuvasti, ja sen ominaisuudet voivat muuttua. Lopullisiin ehtoihin lisätään ennen julkaisua palveluntarjoajan viralliset yhteystiedot, vastuunrajaukset, riidanratkaisu ja kuluttajalle kuuluvat lakisääteiset oikeudet.`,
  },
  privacy: {
    title: "Tietosuoja",
    summary:
      "Tämä tietosuojaseloste on demoversion luonnos. Rekisterinpitäjän tiedot, säilytysajat ja palveluntarjoajat täydennetään ennen tuotantojulkaisua.",
    body: `## 1. Mitä tietoja käsitellään
Palvelu voi käsitellä käyttäjätilin tietoja, kuten nimeä ja sähköpostiosoitetta, ilmoitusten sisältöä, julkista paikkakuntaa sekä palvelun käyttöön liittyviä teknisiä tietoja. Tarkkaa nouto-osoitetta ei näytetä julkisessa ilmoituksessa.

## 2. Miksi tietoja käsitellään
Tietoja käytetään käyttäjätilin ylläpitämiseen, ilmoitusten julkaisemiseen, kauppojen mahdollistamiseen, väärinkäytösten ehkäisemiseen, asiakaspalveluun ja palvelun kehittämiseen.

## 3. Tietojen vastaanottajat
Tietoja voidaan käsitellä palvelun toteuttamiseen tarvittavissa järjestelmissä. Tuotantoversioon dokumentoidaan kaikki henkilötietoja käsittelevät palveluntarjoajat ja mahdolliset tietojen siirrot.

## 4. Säilytys ja suojaus
Tietoja säilytetään vain niin kauan kuin käyttötarkoitus tai lakisääteinen velvoite sitä edellyttää. Käyttöoikeudet rajataan tehtävien mukaan ja tietojen suojaamisessa käytetään asianmukaisia teknisiä ja organisatorisia keinoja.

## 5. Käyttäjän oikeudet
Käyttäjällä voi sovellettavan lainsäädännön perusteella olla oikeus tarkastaa, korjata tai poistaa tietojaan, rajoittaa käsittelyä, vastustaa käsittelyä sekä saada tietonsa siirrettyä. Lopulliseen selosteeseen lisätään yhteydenottotapa pyyntöjä varten.

## 6. Yhteydenotot
Rekisterinpitäjän virallinen nimi, postiosoite, sähköpostiosoite ja mahdollisen tietosuojavastaavan tiedot lisätään ennen palvelun varsinaista julkaisua.`,
  },
  accessibility: {
    title: "Saavutettavuus",
    summary:
      "PC Marketin tavoitteena on tarjota mahdollisimman selkeä ja saavutettava palvelu. Tämä seloste täydennetään auditoinnin jälkeen ennen tuotantojulkaisua.",
    body: `## 1. Saavutettavuuden tila
Palvelu on vielä demovaiheessa, eikä sille ole tehty kattavaa ulkopuolista saavutettavuusauditointia. Tavoitteena on noudattaa soveltuvia WCAG 2.1 AA -tason vaatimuksia ennen varsinaista julkaisua.

## 2. Huomioidut ominaisuudet
Käyttöliittymässä käytetään semanttisia otsikoita, näppäimistöllä käytettäviä toimintoja, näkyviä kohdistustiloja, tekstivastineita ja riittävän suuria tekstejä. Liikettä vähentävä selainasetus huomioidaan animaatioissa.

## 3. Tunnetut puutteet
Demoversion kaikkia näkymiä, lomakkeita ja kolmansien osapuolten sisältöjä ei ole vielä testattu avustavilla teknologioilla. Havaitut puutteet kirjataan ja korjataan ennen tuotantojulkaisua.

## 4. Anna palautetta
Jos huomaat saavutettavuusongelman, voit ilmoittaa siitä palvelun ylläpidolle. Virallinen palautekanava ja tavoitevastausaika lisätään tähän selosteeseen ennen julkaisua.

## 5. Valvonta
Lopulliseen saavutettavuusselosteeseen lisätään sovellettavan lainsäädännön mukaiset valvontaviranomaisen tiedot ja ohjeet saavutettavuuskantelun tekemiseen.`,
  },
};

export function getDefaultLegalPage(slug: LegalPageSlug, locale: Locale): LegalPageContent {
  const page = finnishPages[slug];
  return { ...page, slug, locale, updatedAt: null };
}
