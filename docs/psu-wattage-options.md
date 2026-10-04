# Virtalähteen tehoehdotusten lähteet

Tarkistettu 5.10.2026 valmistajien tuotetiedoista ja ohjeista. Ilmoituksen `wattage`-kentän ehdotukset ovat nimellisiä jatkuvan lähtötehon arvoja, eivät hetkellisiä huipputehoja. Listaa ei muodosteta automaattisesti 50 W:n välein. Muita tehoja voi kirjoittaa käsin; lista ei ole kaikkien valmistettujen virtalähteiden täydellinen luettelo.

| Ehdotukset                   | Valmistajan esimerkkimallit ja lähde                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 300 W                        | [be quiet! TFX POWER 3 Gold](https://www.bequiet.com/en//powersupply/7371)                                                                                      |
| 400 W                        | [be quiet! PURE POWER 10](https://www.bequiet.com/en/powersupply/4182)                                                                                          |
| 450, 550, 650 W              | [be quiet! SYSTEM POWER 11](https://bequiet.com/en/powersupply/system-power-11/5608)                                                                            |
| 500, 600, 700 W              | [Thermaltake SMART käyttöohje](https://file.thermaltake.com/file/qig/SMART500.600.700W_US_manual.pdf)                                                           |
| 750, 850, 1000, 1300, 1600 W | [Seasonic PRIME TX](https://seasonic.com/prime-tx/)                                                                                                             |
| 1050 W                       | [Thermaltake GF A3 Hydrangea Blue käyttöohje](https://file.thermaltake.com/file/qig/TOUGHPOWER_GF_A3_HYDRANGEA_BLUE1050W_Manual.pdf)                            |
| 1200 W                       | [Antec HCG / GSK](https://www.antec.com/product/power-series)                                                                                                   |
| 1250 W                       | [Thermaltake iRGB PLUS Titanium](https://computex.thermaltake.com/2023/news-20230602_03.html)                                                                   |
| 1350 W                       | [Thermaltake GF3 Gold](https://de.thermaltake.com/cartquickpro/catalog_product/view/id/2204)                                                                    |
| 1500 W                       | [Corsair HX1500i](https://www.corsair.com/us/en/p/psu/cp-9020309-na/hx1500i-fully-modular-ultra-low-noise-platinum-atx-1500-watt-pc-power-supply-cp-9020309-na) |
| 1550 W                       | [Thermaltake TF1](https://thermaltake.com/products/toughpower-tf1-1550w-tt-premium-edition)                                                                     |
| 1650 W                       | [Thermaltake GF3 ATX 3.0 testiraportti](https://file.thermaltake.com/file/qig/Toughpower_GF3_1650W_ATX_3_0_Test_Report.pdf)                                     |
| 2000 W                       | [FSP CANNON PRO](https://www.fsplifestyle.com/PROP212005199/) (2000 W nimellisteho 200–240 V:n verkossa)                                                        |

Ehdotukset määritellään tiedostossa `apps/web/src/features/sell/specification-fields.ts`. `ProfileField` käyttää tehokentässä `WattageInput`-valikkoa. Se avautuu kentän kohdistuksesta tai nuolesta, suodattaa kirjoitettaessa ja sallii myös listan ulkopuolisen arvon. Nuolinäppäimet ja Enter valitsevat ehdotuksen; Escape ja kentän ulkopuolelle siirtyminen sulkevat listan.
