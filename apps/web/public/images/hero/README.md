# Etusivun taustakuva

Lisää valitsemasi JPG-, PNG-, AVIF- tai WebP-kuva tähän kansioon. WebP tai AVIF on yleensä paras vaihtoehto sivun latausnopeuden kannalta.

Avaa sen jälkeen `apps/web/src/config/home-hero.ts` ja aseta `HOME_HERO_BACKGROUND_IMAGE` kuvan selainpoluksi. Esimerkiksi tiedosto `oma-taustakuva.webp` asetetaan näin:

```ts
export const HOME_HERO_BACKGROUND_IMAGE = "/images/hero/oma-taustakuva.webp";
```

Suositeltu kuvakoko on vähintään 1920 × 900 pikseliä. Kuvan reunoille ja tekstin taakse lisätään automaattisesti tumma häivytys.
