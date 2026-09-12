import { useState, type FormEvent } from "react";
import { COUNTRY_FLAGS, MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import type { Category, Condition, CountryCode, DemoUser, Listing } from "../../types";
import { Icon } from "../../components/Icon";
import { ModalShell } from "../../components/ModalShell";

interface SellModalProps {
  copy: Messages;
  market: CountryCode;
  user: DemoUser;
  onClose: () => void;
  onPublish: (listing: Listing) => void;
}

export function SellModal({ copy, market, user, onClose, onPublish }: SellModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("gpu");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [shipsTo, setShipsTo] = useState<CountryCode[]>([market]);

  const toggleCountry = (country: CountryCode) =>
    setShipsTo((current) =>
      current.includes(country) ? current.filter((item) => item !== country) : [...current, country],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const numericPrice = Number(price.replace(",", "."));
    if (
      !title.trim() ||
      !location.trim() ||
      !description.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0 ||
      shipsTo.length === 0
    )
      return;
    onPublish({
      id: `listing-${Date.now()}`,
      title: title.trim(),
      subtitle: `${copy[category]} · ${copy[condition === "fair" ? "conditionFair" : condition]}`,
      category,
      brand: title.trim().split(" ")[0],
      priceMinor: Math.round(numericPrice * 100),
      currency: MARKETS[market].currency,
      condition,
      city: location.trim(),
      seller: {
        id: user.id,
        name: user.name,
        initials: user.name.slice(0, 2).toUpperCase(),
        countryCode: market,
        rating: 5,
        reviewCount: 0,
        completedSales: 0,
        verified: false,
        joinedYear: new Date().getFullYear(),
      },
      shipsTo,
      specs: { Kategoria: copy[category], Kunto: copy[condition === "fair" ? "conditionFair" : condition] },
      description: description.trim(),
      priceSignal: "fair",
      buyerProtection: true,
      serialVerified: false,
      createdLabel: "nyt",
      visual: category === "gpu" ? "lime" : category === "cpu" ? "orange" : category === "pc" ? "blue" : "violet",
    });
  };

  return (
    <ModalShell title={copy.sellTitle} onClose={onClose}>
      <div className="sell-wrap">
        <div className="modal-kicker">
          SELL / {MARKETS[market].countryCode} / {MARKETS[market].currency}
        </div>
        <h2>{copy.sellTitle}</h2>
        <p className="modal-lead">{copy.demoNotice}</p>
        <form className="stack-form sell-form" onSubmit={submit}>
          <label className="field-wide">
            {copy.productTitle}
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ASUS TUF RTX 4070 SUPER"
            />
          </label>
          <label>
            {copy.category}
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {(["gpu", "cpu", "memory", "motherboard", "pc", "other"] as Category[]).map((item) => (
                <option key={item} value={item}>
                  {copy[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.price} ({MARKETS[market].currency})
            <input
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="450"
            />
          </label>
          <label>
            {copy.condition}
            <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
              {(["new", "excellent", "good", "fair"] as Condition[]).map((item) => (
                <option key={item} value={item}>
                  {copy[item === "fair" ? "conditionFair" : item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.location}
            <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Helsinki" />
          </label>
          <fieldset className="field-wide shipping-field">
            <legend>{copy.shipsTo}</legend>
            <div>
              {(Object.keys(MARKETS) as CountryCode[]).map((country) => (
                <label key={country} className={shipsTo.includes(country) ? "selected" : ""}>
                  <input type="checkbox" checked={shipsTo.includes(country)} onChange={() => toggleCountry(country)} />
                  {COUNTRY_FLAGS[country]} {country}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field-wide">
            {copy.description}
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Kerro kunnosta, käytöstä, takuusta ja mukana tulevista tarvikkeista."
            />
          </label>
          <button className="button button--primary button--full field-wide" type="submit">
            {copy.publish}
            <Icon name="arrow" />
          </button>
        </form>
      </div>
    </ModalShell>
  );
}
