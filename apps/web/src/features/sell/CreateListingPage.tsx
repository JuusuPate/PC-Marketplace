import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import type { PreparedListingImage } from "../../lib/listing-images";
import { formatMoney } from "../../lib/money";
import { getRuntimeCopy } from "../../lib/runtime-copy";
import { backendMode } from "../../lib/supabase";
import type {
  Category,
  Condition,
  CountryCode,
  DemoUser,
  Listing,
  Locale,
  PrivatePickupAddress,
  Seller,
} from "../../types";
import { ImagePicker } from "./ImagePicker";

interface SpecificationRow {
  id: string;
  name: string;
  value: string;
}

type SellerSummary = Pick<Seller, "rating" | "reviewCount" | "completedSales" | "verified">;

export interface CreateListingPageProps {
  copy: Messages;
  locale: Locale;
  market: CountryCode;
  user: DemoUser;
  seller?: SellerSummary;
  onCancel: () => void;
  onPublish: (listing: Listing, images: PreparedListingImage[], pickupAddress: PrivatePickupAddress) => Promise<void>;
}

const newSpecification = (): SpecificationRow => ({
  id: crypto.randomUUID(),
  name: "",
  value: "",
});

const visualByCategory: Record<Category, Listing["visual"]> = {
  gpu: "lime",
  cpu: "orange",
  memory: "violet",
  motherboard: "silver",
  pc: "blue",
  other: "pink",
};

export function CreateListingPage({ copy, locale, market, user, seller, onCancel, onPublish }: CreateListingPageProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("gpu");
  const [condition, setCondition] = useState<Condition>("good");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [specifications, setSpecifications] = useState<SpecificationRow[]>([newSpecification()]);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PreparedListingImage[]>([]);
  const [city, setCity] = useState(user.pickupAddress?.city ?? "");
  const [streetAddress, setStreetAddress] = useState(user.pickupAddress?.streetAddress ?? "");
  const [postalCode, setPostalCode] = useState(user.pickupAddress?.postalCode ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runtimeCopy = getRuntimeCopy(locale);
  const numericPrice = Number(price.replace(",", "."));
  const formattedPrice =
    Number.isFinite(numericPrice) && numericPrice > 0
      ? formatMoney(Math.round(numericPrice * 100), MARKETS[market].currency, locale)
      : copy.previewPricePlaceholder;

  const sellerRating = seller?.rating ?? 0;
  const sellerReviews = seller?.reviewCount ?? 0;
  const sellerInitials = useMemo(
    () =>
      user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?",
    [user.name],
  );

  const updateSpecification = (id: string, key: "name" | "value", value: string) => {
    setSpecifications((rows) => rows.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const removeSpecification = (id: string) => {
    setSpecifications((rows) => {
      const remaining = rows.filter((row) => row.id !== id);
      return remaining.length > 0 ? remaining : [newSpecification()];
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const incompleteSpecification = specifications.some(
      (row) => (row.name.trim().length > 0 || row.value.trim().length > 0) && (!row.name.trim() || !row.value.trim()),
    );
    if (incompleteSpecification) {
      setError(copy.specIncomplete);
      return;
    }

    if (
      title.trim().length < 5 ||
      brand.trim().length < 2 ||
      model.trim().length < 2 ||
      description.trim().length < 20 ||
      !city.trim() ||
      streetAddress.trim().length < 5 ||
      !/^\d{5}$/.test(postalCode.trim()) ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      setError(copy.formIncomplete);
      return;
    }

    const conditionLabel = copy[condition === "fair" ? "conditionFair" : condition];
    const reservedSpecificationNames = new Set([copy.brand.toLocaleLowerCase(), copy.model.toLocaleLowerCase()]);
    const technicalSpecifications = Object.fromEntries(
      specifications
        .filter(
          (row) =>
            row.name.trim() && row.value.trim() && !reservedSpecificationNames.has(row.name.trim().toLocaleLowerCase()),
        )
        .map((row) => [row.name.trim(), row.value.trim()]),
    );

    const listing: Listing = {
      id: `listing-${Date.now()}`,
      title: title.trim(),
      subtitle: `${brand.trim()} ${model.trim()} · ${conditionLabel}`,
      category,
      brand: brand.trim(),
      priceMinor: Math.round(numericPrice * 100),
      currency: MARKETS[market].currency,
      condition,
      city: city.trim(),
      seller: {
        id: user.id,
        name: user.name,
        initials: sellerInitials,
        countryCode: user.countryCode,
        rating: sellerRating,
        reviewCount: sellerReviews,
        completedSales: seller?.completedSales ?? 0,
        verified: seller?.verified ?? false,
        joinedYear: new Date().getFullYear(),
      },
      shipsTo: [market],
      specs: {
        [copy.brand]: brand.trim(),
        [copy.model]: model.trim(),
        ...technicalSpecifications,
      },
      description: description.trim(),
      priceSignal: "fair",
      buyerProtection: true,
      serialVerified: false,
      createdLabel: copy.justNow,
      visual: visualByCategory[category],
      images: [],
    };

    const pickupAddress: PrivatePickupAddress = {
      streetAddress: streetAddress.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      countryCode: market,
    };

    setBusy(true);
    setError("");
    try {
      await onPublish(listing, images, pickupAddress);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : runtimeCopy.listingError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="create-listing-page" aria-labelledby="create-listing-title">
      <header className="create-listing-page__header">
        <div>
          <span className="section-kicker">{copy.createListingEyebrow}</span>
          <h1 id="create-listing-title">{copy.sellTitle}</h1>
          <p>{copy.createListingIntro}</p>
        </div>
        <button className="button button--outline" type="button" onClick={onCancel} disabled={busy}>
          <Icon name="close" />
          {copy.cancel}
        </button>
      </header>

      <form className="create-listing-form" onSubmit={submit} noValidate>
        <div className="create-listing-form__main">
          <section className="create-listing-section" aria-labelledby="product-details-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">01</span>
              <div>
                <h2 id="product-details-title">{copy.productDetails}</h2>
                <p>{copy.productDetailsHelp}</p>
              </div>
            </div>
            <div className="create-listing-fields">
              <label className="field-wide">
                {copy.productTitle}
                <input
                  required
                  minLength={5}
                  maxLength={100}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="ASUS TUF RTX 4070 SUPER"
                />
              </label>
              <label>
                {copy.category}
                <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                  {(["gpu", "cpu", "memory", "motherboard", "pc", "other"] as Category[]).map((item) => (
                    <option key={item} value={item}>
                      {copy[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {copy.condition}
                <select value={condition} onChange={(event) => setCondition(event.target.value as Condition)}>
                  {(["new", "excellent", "good", "fair"] as Condition[]).map((item) => (
                    <option key={item} value={item}>
                      {copy[item === "fair" ? "conditionFair" : item]}
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
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="450"
                />
              </label>
              <label>
                {copy.brand}
                <input required value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="ASUS" />
              </label>
              <label>
                {copy.model}
                <input
                  required
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="TUF-RTX4070S-O12G-GAMING"
                />
              </label>
            </div>
          </section>

          <section className="create-listing-section" aria-labelledby="technical-details-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">02</span>
              <div>
                <h2 id="technical-details-title">{copy.technicalDetails}</h2>
                <p>{copy.technicalDetailsHelp}</p>
              </div>
            </div>
            <div className="specification-editor">
              {specifications.map((row, index) => (
                <div className="specification-editor__row" key={row.id}>
                  <label>
                    {copy.specName}
                    <input
                      value={row.name}
                      onChange={(event) => updateSpecification(row.id, "name", event.target.value)}
                      placeholder={index === 0 ? copy.memory : "PCIe"}
                    />
                  </label>
                  <label>
                    {copy.specValue}
                    <input
                      value={row.value}
                      onChange={(event) => updateSpecification(row.id, "value", event.target.value)}
                      placeholder={index === 0 ? "12 GB GDDR6X" : "4.0"}
                    />
                  </label>
                  <button
                    className="specification-editor__remove"
                    type="button"
                    aria-label={`${copy.remove}: ${index + 1}`}
                    onClick={() => removeSpecification(row.id)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
              <button
                className="button button--outline specification-editor__add"
                type="button"
                onClick={() => setSpecifications((rows) => [...rows, newSpecification()])}
              >
                <Icon name="plus" />
                {copy.addSpec}
              </button>
            </div>
          </section>

          <section className="create-listing-section" aria-labelledby="description-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">03</span>
              <div>
                <h2 id="description-title">{copy.description}</h2>
                <p>{copy.descriptionHelp}</p>
              </div>
            </div>
            <div className="create-listing-description">
              <textarea
                aria-label={copy.description}
                required
                minLength={20}
                maxLength={4000}
                rows={9}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={copy.descriptionHelp}
              />
              <small>{description.length} / 4000</small>
            </div>
          </section>

          <section className="create-listing-section" aria-labelledby="photos-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">04</span>
              <div>
                <h2 id="photos-title">{copy.photos}</h2>
                <p>{copy.photoHelp}</p>
              </div>
            </div>
            <ImagePicker
              copy={copy}
              images={images}
              alt={title}
              mode={backendMode}
              disabled={busy}
              onChange={setImages}
            />
          </section>

          <section className="create-listing-section" aria-labelledby="seller-details-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">05</span>
              <div>
                <h2 id="seller-details-title">{copy.sellerDetails}</h2>
                <p>{copy.sellerDetailsHelp}</p>
              </div>
            </div>
            <div className="create-listing-seller">
              <div className="create-listing-seller__identity">
                <span className="seller-avatar seller-avatar--large">{sellerInitials}</span>
                <div>
                  <small>{copy.seller}</small>
                  <strong>{user.name}</strong>
                  <span>
                    <Icon name="star" fill="currentColor" />
                    {sellerReviews > 0
                      ? `${sellerRating.toFixed(1)} · ${sellerReviews} ${copy.reviews}`
                      : copy.noReviews}
                  </span>
                </div>
              </div>
              <label className="field-wide">
                {copy.name}
                <input value={user.name} readOnly aria-readonly="true" />
              </label>
              <label>
                {copy.publicLocation}
                <input
                  required
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Helsinki"
                />
                <small>{copy.publicLocationHelp}</small>
              </label>
              <label>
                {copy.postalCode}
                <input
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  minLength={5}
                  maxLength={5}
                  pattern="[0-9]{5}"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="00100"
                />
              </label>
              <label className="field-wide">
                {copy.streetAddress}
                <input
                  required
                  autoComplete="street-address"
                  value={streetAddress}
                  onChange={(event) => setStreetAddress(event.target.value)}
                  placeholder={copy.streetAddressPlaceholder}
                />
              </label>
              <div className="private-address-notice field-wide">
                <Icon name="shield" />
                <div>
                  <strong>{copy.privateAddress}</strong>
                  <p>{copy.privateAddressHelp}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="create-listing-preview" aria-labelledby="listing-preview-title">
          <div className="create-listing-preview__sticky">
            <span className="section-kicker">{copy.listingPreview}</span>
            <h2 id="listing-preview-title">{title.trim() || copy.previewTitlePlaceholder}</h2>
            <p>{copy.reviewBeforePublish}</p>
            <div className={`create-listing-preview__image visual--${visualByCategory[category]}`}>
              {images[0] ? (
                <img src={images[0].previewUrl} alt={images[0].alt || title} />
              ) : (
                <span>{brand.trim().slice(0, 3).toUpperCase() || "PC"}</span>
              )}
            </div>
            <dl>
              <div>
                <dt>{copy.price}</dt>
                <dd>{formattedPrice}</dd>
              </div>
              <div>
                <dt>{copy.condition}</dt>
                <dd>{copy[condition === "fair" ? "conditionFair" : condition]}</dd>
              </div>
              <div>
                <dt>{copy.publicLocation}</dt>
                <dd>{city.trim() || "—"}</dd>
              </div>
              <div>
                <dt>{copy.seller}</dt>
                <dd>{user.name}</dd>
              </div>
            </dl>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button--primary button--full" type="submit" disabled={busy}>
              {busy ? runtimeCopy.publishing : runtimeCopy.publish}
              <Icon name="arrow" />
            </button>
            <button className="button button--ghost button--full" type="button" onClick={onCancel} disabled={busy}>
              {copy.cancel}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}
