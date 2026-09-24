# Yhteinen työskentely ilman muutosten ylikirjoittamista

## Käytä yhtä aktiivista projektikansiota

Tämän yhdistämisen aktiivinen kansio on:

```text
C:\Users\juuso\OneDrive\Tiedostot\ChatGPT\PC-Marketplace
```

Avaa VS Codessa **File → Open Folder** ja valitse juuri tämä kansio. Pyydä myös Codexia työskentelemään tässä kansiossa. Codex-tehtävän oma oletuskansio voi olla muualla, joten projektipolku kannattaa kertoa tehtävän alussa.

`C:\Users\juuso\Documents\Github\PC-Marketplace` on erillinen vanhempi klooni. Se ei päivity pelkästään siksi, että yllä oleva kansio muuttuu. ZIP-paketin purkaminen vanhojen tiedostojen päälle ei yhdistä Git-historiaa.

Tilanne 25.9.2026: yhdistetty ulkoasu ja admin-laajennukset toimitetaan haarassa `codex/admin-activity-audit` ja muutospyynnössä #11. Ennen sen yhdistämistä `main` ei sisällä koko tätä versiota. Neljä aiempaa paikallista katalogimuutosta on tarkoituksella säilytetty työpuussa erillään ulkoasupäivityksestä; niitä ei saa hylätä tai siivota pois.

## Päivittäinen työnkulku

Ennen työn aloitusta tarkista nykyinen haara ja tallentamattomat muutokset:

```powershell
git status
git branch --show-current
```

Jos muutoksia on, selvitä ensin kenen työtä ne ovat. Tallenna oma keskeneräinen työ omaan haaraan ja committiin ennen haaran vaihtamista. Älä käytä Discard Changes-, reset --hard- tai clean-toimintoja muiden työn poistamiseen.

Kun yhteinen päivitys on yhdistetty mainiin ja työpuu on puhdas, aloita uusi oma työ näin:

```powershell
git switch main
git pull --ff-only origin main
git switch -c juuso/etusivun-muutos
```

Valitse joka tehtävälle uusi kuvaava haaranimi. Jos aloitat ennen #11:n yhdistämistä, tee oma haara sen ajantasaisesta haarasta mainin sijasta; muuten admin- ja ulkoasumuutokset eivät ole pohjassa mukana. Älä vaihda haaraa samassa kansiossa toisen vielä työskennellessä.

Muokkaa ominaisuuden omaa tiedostoa. CSS-jaottelu on kuvattu [tyyliohjeessa](../apps/web/src/styles/README.md). Tallenna ja tarkista muutokset VS Coden Source Control -näkymässä tai:

```powershell
git diff
git add -p
git diff --cached
git commit -m "Päivitä etusivun ulkoasua"
```

`git add -p` antaa valita mukaan otettavat muutokset. VS Codessa vastaava on tiedoston tai valittujen rivien Stage Changes. Älä lisää `.env`-tiedostoja, avaimia, ZIP-varmistuksia tai riippuvuuskansioita.

Hae toisen tekemä uusin yhteinen työ ja yhdistä se omaan haaraasi:

```powershell
git fetch origin
git merge origin/main
```

Jos Git ilmoittaa ristiriidasta, avaa tiedosto VS Coden Merge Editorissa. Yhdistä tarvittavat osat molemmista versioista; pelkkä Accept Current tai Accept Incoming voi poistaa toisen toteutuksen. Ristiriidan ratkaisun jälkeen merkitse kyseiset tiedostot valmiiksi ja tee yhdistämiscommit. Jos et ole varma ratkaisusta, pyydä apua ja näytä tiedostopolut sekä virheilmoitus. Älä puske pakolla.

Tarkista ennen GitHubiin viemistä:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run format:check
npm.cmd run test:e2e
git push -u origin juuso/etusivun-muutos
```

Avaa GitHubissa pull request omasta haarastasi `main`-haaraan. Odota vihreät tarkistukset ja yhdistä se. Palaa sitten puhtaassa työpuussa mainiin ja hae yhdistetty versio `git pull --ff-only origin main` -komennolla. Jos pull pysähtyy, selvitä haarojen ero; älä korvaa sitä force pushilla.

## Jos työskentelemme samaan aikaan

- Sovitaan eri tiedostot tai ominaisuudet, jos käytämme samaa kansiota. Samassa kansiossa on vain yksi aktiivinen haara.
- Aidosti rinnakkaiseen työhön käytetään omia Git-worktree-kansioita ja haaroja. Kumpikin tekee commitit ja PR:n; yhdistäminen tapahtuu Gitin kautta.
- Kerro Codexille aluksi projektikansio, oma haara ja mitä tiedostoja muokkaat itse. Kerro lopuksi uusi commit tai PR, jotta seuraava työ alkaa oikeasta versiosta.
- Supabase-migraatiot ovat eri asia kuin Git-push. Jo asennettua migraatiota ei muokata jälkikäteen; tietokantamuutokset tulevat uuteen migraatioon. Katalogin sisältöä voi täydentää adminin katalogieditorissa.
- `.env.local` pysyy paikallisena. Git-push ei siirrä tunnuksia eikä tee Supabase-asennusta.

Git säilyttää committihistorian, mutta ei voi estää saman tallentamattoman tiedoston yhtäaikaista ylikirjoittamista. Siksi pienet commitit, rajatut omat haarat ja muutosten tarkistus ovat olennaisia.
