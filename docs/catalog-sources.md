# Tuotekatalogi ja ilmoituksen tuotetiedot

Päivitetty 3.10.2026. Katalogipäivitys sisältää 1 151 valmistajan julkaisemaa mallia tai kapasiteettiversiota. Aiemmat tunnisteet, niihin liitetyt ilmoitukset, ylläpidon omat tiedot ja piilotetut tuotteet säilyvät. Tämä on laaja lähteisiin perustuva kokoelma, ei lupaus kaikkien valmistajien kaikkien historiallisten tuotteiden kattamisesta.

| Tuoteryhmä          | Päivityksen rivejä | Kattavuus                                                                  |
| ------------------- | -----------------: | -------------------------------------------------------------------------- |
| Prosessorit         |                676 | AMD 392, Intel 284; vaihdettavat pöytäkone- ja työasemasuorittimet         |
| Näytönohjaimet      |                181 | AMD 129, NVIDIA 45, Intel 7; eri muistimäärät erillään                     |
| Emolevyt            |                  6 | MSI:n AM4-, AM5- ja LGA 1700 -malleja                                      |
| RAM                 |                 12 | Kingston FURY Beast, FURY Impact ja ValueRAM; DDR3, DDR3L, DDR4 ja DDR5    |
| Virtalähteet        |                 11 | Corsair RMx 2021/2024 ja SF 2024                                           |
| Tallennuslaitteet   |                 90 | Samsungin sisäiset SATA- ja NVMe-levyt kapasiteeteittain                   |
| Kotelot             |                  7 | Fractal Design                                                             |
| Prosessorijäähdytys |                 44 | Noctuan lähdeluettelon ilma- ja AIO-jäähdyttimet                           |
| Tuulettimet         |                102 | Noctuan lähdeluettelon mallit, myös erikoisjännitteiset versiot nimettyinä |
| Oheislaitteet       |                 22 | Logitech-hiiret                                                            |

Kokonaismäärä tietokannassa voi olla suurempi: päivitys ei poista aiempia tai ylläpidon lisäämiä malleja. Valmiskoneiden vanhat katalogirivit säilytetään viitteiden vuoksi, mutta uuden pelikoneilmoituksen katalogihaku tapahtuu erikseen jokaiselle komponentille.

## Valmistajien lähteet

Jokaisella tuodulla rivillä on `source_url`. Tiedot ovat tuotenimiä ja teknisiä faktoja; valmistajien markkinointitekstejä tai kuvia ei kopioida.

- [AMD:n prosessoritaulukko](https://www.amd.com/en/products/specifications/processors.html): julkinen koneellisesti luettava taulukko. Kannettavien juotettavat FP/BGA-mallit rajattiin pois. Ytimet, säikeet, kanta ja kellotaajuus tulevat taulukosta.
- [AMD:n näytönohjaintaulukko](https://www.amd.com/en/products/specifications/graphics.html): erilliset Component-kortit, joille lähde ilmoittaa muistimäärän.
- [Intelin pöytäkoneprosessorien vertailutaulukko](https://www.intel.com/content/www/us/en/support/articles/000005505/processors.html) ja [valmistajan XLSX](https://cdrdv2.intel.com/v1/dl/getContent/841923?fileName=Intel-Core-Desktop-Boxed-Processors-Comparison-Chart.xlsx): LGA-mallit, kokonaisydinmäärä, säikeet, sarja ja kanta.
- [NVIDIA-vertailu](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/): taulukon RTX/GTX-mallit ja Standard Memory Config. Esimerkiksi 8 GB ja 16 GB pysyvät eri versioina. GeForce poistetaan näkyvistä nimistä.
- Intel Arc: [A-sarjan valmistajan taulukko](https://cdrdv2-public.intel.com/828236/828236_Installation%20BKC%20and%20AI%20Benchmark%20UG%20on%20Intel%20Xeon_ARC%20A770_rev2.2.pdf) ja [B580/B570-taulukko](https://download.intel.com/newsroom/2024/client-computing/Intel-Arc-B580-B570-Media-Deck.pdf).
- Kingston: kunkin rivin oma valmistajan tietolehti, esimerkiksi [DDR4 32 GB / 2 moduulia](https://www.kingston.com/datasheets/KF432C16BBK2_32.pdf), [DDR5 32 GB / 2 moduulia](https://www.kingston.com/datasheets/KF560C36BBEK2-32.pdf), [DDR5 SO-DIMM](https://www.kingston.com/datasheets/KF556S40IBK2-32.pdf), [DDR3 DIMM](https://www.kingston.com/datasheets/KVR16N11_8.pdf) ja [DDR3L SO-DIMM](https://www.kingston.com/datasheets/KVR16LS11_8.pdf). Ei mielivaltaisia kapasiteetti/nopeus-yhdistelmiä. Osanumero säilyy hakusanana. Nopeus tarkoittaa valmistajan ilmoittamaa muistinsiirtonopeutta; vanhan käyttöliittymän MHz-merkintä säilyy toistaiseksi.
- Samsung: [sisäisten SSD-levyjen mallit ja kapasiteetit](https://semiconductor.samsung.com/consumer-storage/support/warranty/) sekä [valmistajan tietolehdet](https://semiconductor.samsung.com/consumer-storage/support/documents/). SATA-riveissä käytetään 2,5 tuuman versiota; saman perheen mahdollisia mSATA/M.2 SATA -versioita ei luoda oletuksena.
- MSI: rivikohtainen Specification-sivu, esimerkiksi [PRO B650-P WIFI](https://www.msi.com/Motherboard/PRO-B650-P-WIFI/Specification) ja [B550M PRO-VDH WIFI](https://www.msi.com/Motherboard/B550M-PRO-VDH-WIFI/Specification).
- Corsair: [RMx 2021 -ohjekirja](https://assets.corsair.com/image/upload/corsairmedia/sys_master/productcontent/WW_RMx_Series_2021_QSG_Web_AD.pdf), [RMx 2024](https://www.corsair.com/us/en/explorer/diy-builder/power-supply-units/corsair-rmx-series/) ja [SF 2024](https://www.corsair.com/us/en/explorer/diy-builder/power-supply-units/sf750sf850sf1000-platinum-atx-31-everything-you-need-to-know/). Eri vuosimallit pidetään erillään.
- Noctua: [jäähdytinluettelo](https://www.noctua.at/en/products/browse/coolers), mallikohtaiset Specifications-sivut ja [tuuletinluettelo](https://www.noctua.at/en/products/browse/fans). Kantayhteensopivuus kuvaa nykyistä valmistajan tukea; käytetyn jäähdyttimen mukana olevat kiinnikkeet pitää kertoa myyntikuvauksessa. Tuuletinluetteloa voi käyttää pelikoneen osavalinnassa; erillisen tuulettimen myyntilomake on tarkoituksella pelkistetty.
- Fractal Design: mallikohtaiset sivut, esimerkiksi [North](https://www.fractal-design.com/products/cases/north-series/north/north-charcoal-black/) ja [Define 7 XL](https://www.fractal-design.com/products/cases/define/define-7-xl/). Koko kertoo tuetut emolevystandardit, kotelotyyppi yleisen kokoluokan.
- [Logitechin hiiriluettelo](https://www.logitechg.com/en-us/shop/c/logig-mice): nimet, ei arvattuja teknisiä lisätietoja.

## Käyttö ja täydentäminen

Ilmoitusta luotaessa valitaan **Tuotekatalogista** tai **Kirjoitan itse**. Katalogivalinta täyttää tekniset tiedot ja näyttää ne yhteenvetona. **Muokkaa manuaalisesti** säilyttää kenttien arvot, avaa muokkauksen ja irrottaa tuotemalliviitteen, jotta muokattu tuote ei vääristä alkuperäisen mallin markkinatilastoa. Näytönohjaimessa piirimalli ja kortin valmistaja/versio ovat erillisiä. Otsikkoa voi aina kirjoittaa itse.

Ylläpidon **Tuotekatalogi → Lisää malli / Muokkaa** sisältää kategoriakohtaiset tekniset kentät sekä valmistajan lähdesivun. Tallenna vain oikeaksi tarkistetut tiedot. Uudet tiedot tallentuvat Supabaseen ja tulevat ilmoituksen katalogihakuun. Muutokset eivät takautuvasti muuta myyjien jo julkaisemia tietoja. Aiempi editori voi edelleen tallentaa mallin tyhjentämättä uusia teknisiä tietoja.

SQL-päivityksen `expanded_component_catalog` JSON-osuus on tämän tuontierän tarkastettava lähdeaineisto. `scripts/read-manufacturer-tables.py INPUT_DIRECTORY OUTPUT_JSON` lukee AMD/NVIDIA-HTML-viennit ja Intel-XLSX:n ilman verkko- tai tietokantakirjoituksia. Muut rivit on tarkistettu yllä mainituista tietolehdistä. Uudet lisäykset tehdään ylläpidossa tai uutena migraationa, ei muuttamalla asennettua migraatiota.

Demotilan hakua varten `node scripts/build-demo-catalog.mjs` tuottaa samasta migraatioaineistosta erillisen, vasta hakua käytettäessä ladattavan JSON-tiedoston. Demon tunnisteet eivät ole Supabasen tuotetunnisteita, eikä demohaku tee tietokantakirjoituksia. Ylläpito ei käytä demodataa.
