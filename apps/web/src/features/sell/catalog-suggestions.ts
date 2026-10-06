import type { ProductModel } from "../../lib/product-model-service";

/**
 * Sekoittaa vain haun jo löytämät mallit Fisher–Yates-menetelmällä.
 * Ei muuta alkuperäistä listaa, mallien tietoja tai palvelun sivurajausta; random voidaan korvata testeissä.
 */
export function shuffleCatalogSuggestions<T extends ProductModel>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
