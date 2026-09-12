import type { Locale } from "../types";

interface RuntimeCopy {
  connectedBadge: string;
  connectedNotice: string;
  confirmationRequired: string;
  working: string;
  publish: string;
  publishing: string;
  listingError: string;
}

const messages: Record<Locale, RuntimeCopy> = {
  fi: {
    connectedBadge: "SUPABASE BETA",
    connectedNotice: "Käyttäjätilit ja ilmoitukset tallennetaan palvelimelle. Oikeita maksuja ei käsitellä.",
    confirmationRequired: "Tarkista sähköpostisi ja vahvista tili ennen kirjautumista.",
    working: "Hetki…",
    publish: "Julkaise ilmoitus",
    publishing: "Julkaistaan…",
    listingError: "Tietokantaan ei saatu yhteyttä. Yritä hetken kuluttua uudelleen.",
  },
  sv: {
    connectedBadge: "SUPABASE BETA",
    connectedNotice: "Konton och annonser sparas på servern. Inga riktiga betalningar behandlas.",
    confirmationRequired: "Kontrollera din e-post och bekräfta kontot innan du loggar in.",
    working: "Ett ögonblick…",
    publish: "Publicera annons",
    publishing: "Publicerar…",
    listingError: "Databasen kunde inte nås. Försök igen om en stund.",
  },
  da: {
    connectedBadge: "SUPABASE BETA",
    connectedNotice: "Konti og annoncer gemmes på serveren. Der behandles ingen rigtige betalinger.",
    confirmationRequired: "Tjek din e-mail og bekræft kontoen, før du logger ind.",
    working: "Et øjeblik…",
    publish: "Udgiv annonce",
    publishing: "Udgiver…",
    listingError: "Der kunne ikke oprettes forbindelse til databasen. Prøv igen senere.",
  },
  nb: {
    connectedBadge: "SUPABASE BETA",
    connectedNotice: "Kontoer og annonser lagres på serveren. Ingen ekte betalinger behandles.",
    confirmationRequired: "Sjekk e-posten og bekreft kontoen før du logger inn.",
    working: "Et øyeblikk…",
    publish: "Publiser annonse",
    publishing: "Publiserer…",
    listingError: "Kunne ikke koble til databasen. Prøv igjen om litt.",
  },
  en: {
    connectedBadge: "SUPABASE BETA",
    connectedNotice: "Accounts and listings are stored on the server. No real payments are processed.",
    confirmationRequired: "Check your email and confirm your account before signing in.",
    working: "One moment…",
    publish: "Publish listing",
    publishing: "Publishing…",
    listingError: "The database could not be reached. Please try again shortly.",
  },
};

export const getRuntimeCopy = (locale: Locale) => messages[locale];
