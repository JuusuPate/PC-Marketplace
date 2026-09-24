import type { Locale } from "../../types";

const en = {
  label: "Marketplace highlights",
  cards: [
    {
      label: "BUY WITH CARE",
      title: "Safer trading",
      body: "Review product photos, condition and the seller's details before agreeing on a purchase.",
    },
    { label: "BUILD", title: "Ready-made solutions", body: "Find components and complete PCs in one place." },
    {
      label: "COMMUNITY",
      title: "From one enthusiast to another",
      body: "A community that understands PC parts and the joy of building.",
    },
  ],
};
const fi: typeof en = {
  label: "Markkinapaikan esittely",
  cards: [
    {
      label: "TUTUSTU TUOTTEESEEN",
      title: "Turvalliset kaupat",
      body: "Tutustu tuotteen kuviin, kuntoon ja myyjän tietoihin ennen kaupasta sopimista.",
    },
    {
      label: "KOKOONPANO",
      title: "Valmiit ratkaisut",
      body: "Hae korkealaatuisia komponentteja ja valmiita koneita helposti yhdestä paikasta.",
    },
    {
      label: "YHTEISÖ",
      title: "Harrastajilta toisille",
      body: "Yhteisö, joka ymmärtää PC-osien arvoa ja rakentamisen merkityksen.",
    },
  ],
};
const sv: typeof en = {
  label: "Om marknadsplatsen",
  cards: [
    {
      label: "GRANSKA PRODUKTEN",
      title: "Tryggare affärer",
      body: "Granska produktbilder, skick och säljarens uppgifter innan ni kommer överens om köpet.",
    },
    { label: "BYGGE", title: "Färdiga lösningar", body: "Hitta komponenter och kompletta datorer på ett ställe." },
    {
      label: "GEMENSKAP",
      title: "Från entusiast till entusiast",
      body: "En gemenskap som förstår värdet av datordelar och glädjen i att bygga.",
    },
  ],
};
export function HomeHighlights({ locale }: { locale: Locale }) {
  const copy = locale === "fi" ? fi : locale === "sv" ? sv : en;
  return (
    <section className="home-hero-cards section-shell" aria-label={copy.label}>
      <div className="home-hero-cards__grid">
        {copy.cards.map((card, index) => (
          <article className="home-hero-card" key={index}>
            <div className={`home-hero-card__art home-hero-card__art--${["one", "two", "three"][index]}`}>
              <div className="home-hero-card__content">
                <span className="section-index">{card.label}</span>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
