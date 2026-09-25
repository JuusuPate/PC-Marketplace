# Tuotekatalogi

## Täydennä itse

1. Kirjaudu ylläpitäjänä ja avaa **Admin Dashboard → Tuotekatalogi** (`/admin/catalog`).
2. Valitse tuoteryhmä. Alkuperäisessä aloituskatalogissa oli kolme mallia jokaisessa kymmenessä ryhmässä; malleja voi lisätä ilman kolmen tuotteen rajaa.
3. Paina **Lisää malli**. Täytä valmistaja ja mallin nimi. Käytä **Versio / kapasiteetti / osanumero** -kenttää esimerkiksi 10 GB / 12 GB, muistikitin osanumeron tai virtalähteen vuosimallin erottamiseen.
4. Lisää halutessasi vaihtoehtoisia hakusanoja, esimerkiksi `rtx4070 4070super`. Tallenna.
5. **Muokkaa** korjaa olemassa olevan mallin. Poista valinta **Valittavissa ilmoitusta luotaessa**, jos haluat piilottaa mallin uusilta ilmoituksilta. Vanhojen ilmoitusten yhteys säilyy.

Samaa valmistajaa, mallia ja versiota ei voi lisätä samaan ryhmään kahdesti (kirjainkoko ja reunavälit ohitetaan). Mallin tuoteryhmää ei vaihdeta jälkikäteen; luo tarvittaessa uusi malli oikeaan ryhmään. Samanaikaiset muokkaukset tunnistetaan, ja muuttunut malli täytyy ladata uudelleen. Muutokset kirjataan ylläpidon muutoslokiin.

## Ilmoituksen luonti

Valitse tuoteryhmä ja kirjoita **Hae tuotemallia** -kenttään valmistaja, malli tai hakusana. Haku avautuu vasta kirjoitettaessa ja näyttää myös malliversion, jotta eri muistimäärät erottuvat. Jos osumia on yli 20, selaa hakutulosten sivuja. Valitse tulos: valmistaja ja mallikenttä täyttyvät, ja tyhjä otsikko saa mallin nimen. Valinta yhdistää ilmoituksen pysyvään malliin. Valmistajan, mallitekstin tai tuoteryhmän muuttaminen poistaa aiemman yhteyden. Mallia ei ole pakko valita: puuttuvan tuotteen voi syöttää käsin. Katalogin häiriö ei estä käsinsyöttöä.

Katalogi on palvelimen tieto; demotila ei luo kopioita oikeasta katalogista. Mallin piilottaminen ei riko olemassa olevan ilmoituksen myöhempää käsittelyä. Paikallisen sovelluksen ilmoituseditori säilyttää malliyhteyden tavallisessa muokkauksessa, kun mallin tietoja ei vaihdeta.

## Aloitussisältö: 30 mallia

Myöhempi migraatio `20260925190900_amd_gpu_catalog_seed.sql` lisää kaksi AMD-näytönohjainta alkuperäisen 30 mallin lisäksi: Radeon RX 6800 XT 16 GB ja Radeon RX 6900 XT 16 GB. Jo asennettua alkuperäistä migraatiota ei muuteta.

| Ryhmä                 | Kolme aloitusmallia                                            |
| --------------------- | -------------------------------------------------------------- |
| Näytönohjaimet        | NVIDIA GeForce RTX 3070 8 GB, RTX 3080 10 GB, RTX 3060 Ti 8 GB |
| Prosessorit           | AMD Ryzen 5 5600, AMD Ryzen 7 5800X, Intel Core i5-12400F      |
| Emolevyt              | MSI B550-A PRO, PRO B650-P WIFI, PRO B660M-P WIFI DDR4         |
| Muistit               | Kingston FURY Beast DDR4-3200: KF432C16BBK2/16, /32 ja /64     |
| Virtalähteet          | Corsair RM650x, RM750x ja RM850x (2021)                        |
| Tallennuslaitteet     | Samsung 970 EVO Plus, 980 PRO ja 990 EVO (1 TB)                |
| Kotelot               | Fractal Design Define R5, Meshify C, Focus G                   |
| Jäähdytys             | Noctua NH-D15, NH-U12S, NH-L9i                                 |
| Pelikoneet            | MSI Trident 3, Infinite A, Codex 3 -mallistot                  |
| Oheislaitteet ja muut | Logitech G502 HERO, G203 LIGHTSYNC, PRO X SUPERLIGHT 2         |

Pelikoneiden aloitusrivit ovat mallistoja: niiden kokoonpanot vaihtelevat. Lisää tarkat kokoonpanot erillisinä versioina ennen tarkkaa hintavertailua. Myös näytönohjaimissa jäähdytys- ja valmistajaversiot voivat poiketa; aloitusrivit erottelevat GPU-mallin ja muistimäärän. Kunto, takuu ja varusteet eivät vielä jaa keskiarvoja omiin ryhmiinsä.

Mallinimien tarkistuksessa käytetyt valmistajien lähteet:

- [NVIDIA RTX 30 -sarja](https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/)
- [AMD Ryzen 5600](https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-5000-series/amd-ryzen-5-5600.html), [AMD Ryzen 5800X](https://ir.amd.com/news-events/press-releases/detail/972/amd-launches-amd-ryzen-5000-series-desktop-processors-the-fastest-gaming-cpus-in-the-world), [Intel i5-12400F](https://www.intel.com/content/www/us/en/products/sku/134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz/specifications.html)
- [MSI B550-A PRO](https://www.msi.com/Motherboard/B550-A-PRO), [B650-P WIFI](https://www.msi.com/Motherboard/PRO-B650-P-WIFI), [B660M-P WIFI DDR4](https://www.msi.com/Motherboard/PRO-B660M-P-WIFI-DDR4/Specification)
- [Kingston 16 GB](https://www.kingston.com/dataSheets/KF432C16BBK2_16.pdf), [32 GB](https://www.kingston.com/dataSheets/KF432C16BBK2_32.pdf), [64 GB](https://www.kingston.com/dataSheets/KF432C16BBK2_64.pdf)
- [Corsair RMx 2021](https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/WW_RMx_Series_2021_QSG_Web_AD.pdf)
- [Samsungin malliluettelo](https://images.samsung.com/is/content/samsung/assets/sk/new/Rewardspoints-tabulkaSK.pdf), [Fractal Design -kotelot](https://www.fractal-design.com/products/cases/)
- [Noctuan malliluettelo](https://noctua.at/pub/media/wysiwyg/computex/2019/noctua_computex_2019_press_kit.pdf), [MSI-konemallistot](https://www.msi.com/Landing/write-a-review)
- [Logitech G502/G203](https://www.logitech.com/en-us/discover/a/gaming-mice-under-200), [Logitech Superlight 2](https://www.logitech.com/en-us/discover/a/essential-gaming-gear)

## Mallikohtaiset markkinatiedot

Tuotekatalogin taulukko näyttää jokaisen mallin aktiivisten ilmoitusten määrän ja keskipyynnin sekä valmiiden tilausten määrän ja keskimääräisen tuotehinnan. Rajaus on sama FI/EUR kuin Markkinatiedot-näkymässä; mukana ovat kaikki ajat ja tilausten nykyinen tila. Ilmoitukset ja tilaukset aggregoidaan erikseen. Puuttuva havainto näkyy tekstinä **Ei tietoa**.

Vanhoja ilmoitusotsikoita ei yhdistetä malleihin arvauksella. Näet aktiivisten, vielä yhdistämättömien ilmoitusten määrän. Historiallisten tilausten ryhmittely käyttää ilmoituksen nykyistä malliyhteyttä, ei erillistä ostohetken mallikopiota. Hinnat alkavat kertyä oikeista yhdistetyistä ilmoituksista ja tilauksista; aloituskatalogissa ei ole keksittyjä hintahavaintoja.

## Tekniset rajat ja käyttöönotto

Migraatio `0013_product_model_catalog.sql` edellyttää aiemmat katalogi- ja admin-migraatiot. Uudet taulut käyttävät RLS-suojausta. Julkinen haku palauttaa enintään 20 aktiivista mallia sivulla; ylläpidon tilastot ja tallennus tarkistavat admin-roolin jokaisella kutsulla. Suora kirjoittaminen katalogitauluun ei ole sallittua selainrooleille.

Ilmoituksen `catalog_model_id` on viite malliin. Nykyiset create/update-RPC:t välittävät valinnan varatulla `_catalog_model_id`-avaimella, jonka tietokantatriggeri tarkistaa ja poistaa julkisista teknisistä tiedoista saman operaation aikana. Mallin ja tuoteryhmän on vastattava toisiaan. Ympäristöasetuksia ei muuteta.

136 automaattista testiä, tyyppitarkistus ja tuotantokäännös läpäisivät. Myös paikallisen sovelluksen kaksi aiempaa E2E-testiä läpäisivät. Migraation asennus yhdistettyyn Supabase-projektiin onnistui 18.9.2026.

Selaimessa tarkistettu: GPU- ja CPU-katalogit, olemassa olevan mallin tallennus samoilla tiedoilla, `rtx3070`-hakusana, mallin valinta ja valmistajan/mallin/otsikon täyttyminen sekä malliyhteyden poistuminen käsin muokattaessa. Testi-ilmoitusta ei julkaistu. Oikeat hinta-aggregaatit olivat tyhjiä; laskenta tarkistettiin tietokantatestien aineistolla.

## Katalogin täydentäminen

Lisää mallit ylläpitäjänä sivulla `/admin/catalog`. Mallien määrälle ei ole kolmen tuotteen rajaa: kolme on alkuperäinen aloitussisältö tuoteryhmää kohden. Voit myös lisätä rivejä Supabasen Table Editorissa tauluun `public.catalog_product_models` ylläpitäjän tietokantaoikeuksilla. Valitse olemassa oleva tuoteryhmän tunniste (`category`) ja täytä `brand`, `name` sekä tarvittaessa `variant` ja `aliases`. Eri muistimäärät ja muut versiot erotellaan `variant`-kentällä; samaa yhdistelmää ei voi lisätä kahdesti.

Jo asennetun `0013_product_model_catalog.sql`-tiedoston muokkaus ei päivitä olemassa olevaa Supabase-tietokantaa. Käytä katalogieditoria tai erillistä uutta migraatiota, jos haluat jakaa lisäykset myös muiden kehittäjien tietokantoihin. Älä suorita vanhaa taulujen luontimigraatiota uudelleen.

Katalogitesti varmistaa vähintään kolme aloitusmallia kussakin alkuperäisessä tuoteryhmässä sekä AMD- ja Intel-prosessorien olemassaolon. Lisämallit, lisävalmistajat ja lisäryhmät ovat sallittuja. Hakutestit käyttävät erillistä testituotetta ja laskevat viimeisen sivun tuotemäärän perusteella. Testit suoritetaan erillisessä paikallisessa testitietokannassa, eivät Supabasen tuotetiedoilla.
