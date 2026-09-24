# Tyylien rakenne

`main.tsx` lataa `index.css`-tiedoston. Se sisältää vain CSS-importit niiden tarkoituksellisessa järjestyksessä.

| Kansio                  | Vastuu                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `base/`                 | Värit ja muut muuttujat, selaimen perustyylit, yhteiset luettavuuskorjaukset ja liikkeen vähentäminen |
| `layout/`               | Sivun leveys, ilmoituspalkki, ylätunniste, tilipainikkeet ja alatunniste                              |
| `components/`           | Yhteiset painikkeet, valitsimet, ilmoituskortit ja tuotekuvat, lomakkeet, modaalit ja ilmoitusviestit |
| `features/home/`        | Etusivun pääalue, nostetut ilmoitukset, luottamuspalkki, ostajansuoja, toimintaohje ja myyntikehotus  |
| `features/catalog/`     | Tuoteryhmäsivu ja tuotemallin hakukenttä                                                              |
| `features/marketplace/` | Ilmoituslistan haku, suodattimet ja otsikot                                                           |
| `features/listings/`    | Ilmoituksen tietosivu, kuvagalleria ja raportointilomake                                              |
| `features/sell/`        | Ilmoituksen luonti ja muokkaus, vaiheistus, kuvat ja esikatselu                                       |
| `features/auth/`        | Kirjautuminen, rekisteröityminen ja salasanan palautus                                                |
| `features/account/`     | Oma tili, omat ilmoitukset, tilaukset ja markkinatilanne                                              |
| `features/checkout/`    | Kassasivu ja tilaussumma                                                                              |
| `features/legal/`       | Ehto- ja tietosuojasivut sekä niiden muokkaus                                                         |
| `responsive/`           | Nykyiset sivunlaajuiset työpöytä-, tabletti- ja mobiilisäännöt                                        |

Adminin ja suosikkien jo erilliset tyylit ovat omien ominaisuuksiensa vieressä:

- `../features/admin/styles/admin-dashboard.css`
- `../features/favourites/styles/favourites-modal.css`

Niiden React-komponentit lataavat nämä tyylit kuten ennenkin. Muita tyylejä ladataan vain `index.css`-tiedostosta, jotta samaa tiedostoa ei tuoda kahdesti eri järjestyksessä.

## Työskentely tiimissä

ZIP-version ulkoasun yhdistäminen 25.9.2026 säilyttää tämän rakenteen. `global.css` ei ole käytössä. Uudet omistajat:

- `components/language-picker.css`: kielivalitsimen painike, valikko ja näppäimistökohdistus.
- `features/home/highlights.css`: etusivun kolme esittelykorttia, taustat ja mobiiliasettelu; sisältö on `features/home/HomeHighlights.tsx`-komponentissa.
- `features/legal/safety.css`: turvallisuussivun pääalue.
- Nykyiset `layout/header.css`, `layout/footer.css` ja `features/home/hero.css`: ZIP-version logo, alatunniste ja pyöristetty etusivun pääalue.

Ilmoituksen suuren kuvan, muokkauksen, salasanan palautuksen, katalogihaun ja adminin uudemmat tyylit säilyvät. Ilmoituskortin kuva täyttää kortin ZIPin tapaan; tietosivun suuri kuva näytetään edelleen kokonaisena. Esittelykortit ovat saavutettavia ja lokalisoituja; tuotekortti ei lupaa palvelun tarkastaneen jokaista ilmoitusta.

Git-työnkulku: [Yhteinen työskentely](../../../../docs/team-workflow.md).

- Muokkaa tyylin omistavaa ominaisuus- tai komponenttitiedostoa. Lisää uudet, vain yhtä ominaisuutta koskevat mediaehdot samaan tiedostoon.
- Käytä yhteisiä muuttujia `base/tokens.css`-tiedostosta. Käytä ominaisuudelle omaa luokkaprefiksiä, esimerkiksi `create-listing-`.
- Säilytä `index.css`-importtien järjestys: saman vahvuisista säännöistä myöhempi voittaa. Tiedostot ovat alkuperäisen CSS:n järjestyksessä, eivät aakkosjärjestyksessä.
- `base/readability.css` sisältää olemassa olevat usean komponentin tekstikokojen korjaukset. `responsive/` sisältää olemassa olevat usean ominaisuuden yhteiset mediaehdot. Ne tulevat perustyylien jälkeen; tarkista nämä myös muuttaessasi tekstikokoja tai mobiiliasettelua.
- Jos siirrät olemassa olevia sääntöjä tiedostosta toiseen, tarkista myös latausjärjestys. Pelkkä siirtäminen voi muuttaa ulkoasua.

Refaktoroinnissa ei lisätty CSS Modules -rajausta tai cascade layers -kerroksia: nykyiset luokkanimet ja sääntöjen järjestys säilytettiin.
