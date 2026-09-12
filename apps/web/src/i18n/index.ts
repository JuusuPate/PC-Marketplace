import { da } from "./messages/da";
import { en } from "./messages/en";
import { fi, type Messages } from "./messages/fi";
import { nb } from "./messages/nb";
import { sv } from "./messages/sv";
import type { Locale } from "../types";

const dictionaries: Record<Locale, Messages> = { fi, sv, da, nb, en };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
