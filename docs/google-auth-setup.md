# Kirjautumissivu ja Googlen käyttöönotto

## Sivut

- `/kirjaudu`: sähköposti- ja Google-kirjautuminen
- `/rekisteroidy`: tunnuksen luonti sähköpostilla tai Googlella
- `/salasana/unohtunut`: palautuslinkin pyytäminen

`paluu`-parametri säilyttää sivuston sisäisen jatko-osoitteen myös OAuthin ja
sähköpostivahvistuksen yli. Ulkoiset osoitteet, ohjausmerkit ja kirjautumissivulle
johtavat silmukat hylätään. Istunto ja ylläpitorooli käsitellään edelleen
Auth-palvelussa ja palvelimen roolitaulussa.

Google käyttää samaa OAuth-toimintoa sekä kirjautumiseen että tunnuksen luontiin:
Supabase luo tarvittaessa uuden käyttäjän ja nykyinen `handle_new_user`-triggeri
luo hänelle tavallisen julkisen profiilin. Google ei anna ylläpito-oikeutta.

## Käyttöönoton tämänhetkinen tilanne

2.11.2026 projektin julkinen Auth-asetus ilmoitti `google: false`.
Google Cloudin OAuth-asiakasta ei käyttäjän mukaan ole vielä luotu.
Sovelluksen Google-toteutus on valmis, mutta todellinen Google-kirjautuminen
vaatii seuraavan asetuksen. Sovellus tarkistaa providerin julkisen käyttötilan
ennen ohjausta ja tarjoaa sähköpostikirjautumista, jos Google ei ole käytössä.

## Tee nämä Google Cloudissa ja Supabasessa

1. Avaa [Google Auth Platform](https://console.cloud.google.com/auth/overview).
   Valitse tai luo projekti ja määritä sovelluksen nimi, yhteyssähköposti ja
   ulkoinen käyttäjäyleisö. Testitilassa lisää haluamasi testaajat testikäyttäjiksi.
2. Luo [Clients-kohdassa](https://console.cloud.google.com/auth/clients) uusi
   OAuth-asiakas, jonka tyyppi on **Web application**.
3. Lisää kehityksen JavaScript-origineiksi `http://localhost:4173` ja tarvittaessa
   `http://127.0.0.1:4173`. Tuotannossa käytä sivuston omaa HTTPS-osoitetta.
4. Lisää **Authorized redirect URIs** -kohtaan täsmälleen:

   ```text
   https://srwfejszzzgkfqpucxjp.supabase.co/auth/v1/callback
   ```

5. Avaa [Supabasen Google-provider](https://supabase.com/dashboard/project/srwfejszzzgkfqpucxjp/auth/providers?provider=Google).
   Ota Google käyttöön ja lisää Google Cloudin **Client ID** sekä **Client Secret**.
   Tallenna ne vain Supabasen asetukseen. Client Secret ei kuulu keskusteluun,
   selainkoodiin, `VITE_`-muuttujiin tai Gitiin.
6. Avaa [Supabasen URL-asetukset](https://supabase.com/dashboard/project/srwfejszzzgkfqpucxjp/auth/url-configuration).
   Lisää paikallisiin sallittuihin paluuosoitteisiin `http://localhost:4173/**`
   ja tarvittaessa `http://127.0.0.1:4173/**`. Tuotannossa salli oman sivuston
   kirjautumissivun URL ja siihen tarvittavat paluuparametrit.
7. Testaa uudella Google-käyttäjällä tunnuksen luonti, olemassa olevalla käyttäjällä
   kirjautuminen, Google-vaiheen peruuttaminen ja jatkaminen `/myy/uusi`-sivulle.

Sähköpostilinkit palaavat samalle `/kirjaudu`-reitille, joten URL-asetuksen
päivitys koskee myös vahvistus- ja salasananpalautuslinkkien jatko-osoitteita.

[Supabasen virallinen Google-ohje](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Tarkistus

Yksikkötestit kattavat turvalliset paluuosoitteet, OAuth-kutsun, pois käytöstä
olevan providerin, verkkovirheen ja sähköpostilinkkien osoitteet. Selaintestit
kattavat omat reittisivut, rekisteröinnin, salasanojen vahvistuksen, selainhistorian,
ilmoituksen luontiin palaamisen sekä mobiilileveyden. Todellisen Google-suostumuksen
läpikäynti ja sähköpostin toimitus tulee varmistaa käyttöönottovaiheen jälkeen.
