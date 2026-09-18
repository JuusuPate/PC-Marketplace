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
import { ProductModelPicker } from "./ProductModelPicker";
import { ImagePicker } from "./ImagePicker";
import { getGuidedSpecificationFields, specificationCopy } from "./specification-fields";

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
  psu: "silver",
  storage: "blue",
  case: "silver",
  cooling: "blue",
  pc: "blue",
  other: "pink",
};

interface FieldLabelProps {
  label: string;
  requiredText: string;
  optionalText?: string;
  required?: boolean;
}

function FieldLabel({ label, requiredText, optionalText, required = false }: FieldLabelProps) {
  return (
    <span className="field-label">
      <span>{label}</span>
      {required ? (
        <>
          <span className="required-mark" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> ({requiredText})</span>
        </>
      ) : optionalText ? (
        <small>{optionalText}</small>
      ) : null}
    </span>
  );
}

export function CreateListingPage({ copy, locale, market, user, seller, onCancel, onPublish }: CreateListingPageProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("gpu");
  const [condition, setCondition] = useState<Condition>("good");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [catalogModelId, setCatalogModelId] = useState<string | null>(null);
  const [guidedSpecifications, setGuidedSpecifications] = useState<Record<string, string>>({});
  const [specifications, setSpecifications] = useState<SpecificationRow[]>([]);
  const [technicalDetailsUnknown, setTechnicalDetailsUnknown] = useState(false);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PreparedListingImage[]>([]);
  const [city, setCity] = useState(user.pickupAddress?.city ?? "");
  const [streetAddress, setStreetAddress] = useState(user.pickupAddress?.streetAddress ?? "");
  const [postalCode, setPostalCode] = useState(user.pickupAddress?.postalCode ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runtimeCopy = getRuntimeCopy(locale);
  const formCopy = specificationCopy[locale];
  const photosRequired = backendMode !== "demo";
  const guidedFields = getGuidedSpecificationFields(category, locale);
  const technicalSectionTitle =
    category === "pc" ? formCopy.pcTitle : category === "other" ? formCopy.optionalTitle : formCopy.componentTitle;
  const technicalSectionHelp =
    category === "pc" ? formCopy.pcHelp : category === "other" ? formCopy.optionalHelp : formCopy.componentHelp;
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
    setSpecifications((rows) => rows.filter((row) => row.id !== id));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const incompleteSpecification =
      !technicalDetailsUnknown &&
      specifications.some(
        (row) => (row.name.trim().length > 0 || row.value.trim().length > 0) && (!row.name.trim() || !row.value.trim()),
      );
    if (incompleteSpecification) {
      setError(copy.specIncomplete);
      return;
    }

    if (
      title.trim().length < 5 ||
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
    if (photosRequired && images.length === 0) {
      setError(formCopy.photoRequired);
      return;
    }

    const conditionLabel = copy[condition === "fair" ? "conditionFair" : condition];
    const reservedSpecificationNames = new Set([copy.brand.toLocaleLowerCase(), copy.model.toLocaleLowerCase()]);
    const technicalSpecifications = technicalDetailsUnknown
      ? {}
      : Object.fromEntries(
          specifications
            .filter(
              (row) =>
                row.name.trim() &&
                row.value.trim() &&
                !reservedSpecificationNames.has(row.name.trim().toLocaleLowerCase()),
            )
            .map((row) => [row.name.trim(), row.value.trim()]),
        );
    const guidedTechnicalSpecifications = technicalDetailsUnknown
      ? { [copy.technicalDetails]: formCopy.unknown }
      : Object.fromEntries(
          guidedFields
            .map((field) => [field.label, guidedSpecifications[field.key]?.trim()] as const)
            .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
        );
    const identity = [brand.trim(), model.trim()].filter(Boolean).join(" ");

    const listing: Listing = {
      id: `listing-${Date.now()}`,
      title: title.trim(),
      subtitle: `${identity || copy[category]} · ${conditionLabel}`,
      category,
      catalogModelId,
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
        ...(brand.trim() ? { [copy.brand]: brand.trim() } : {}),
        ...(model.trim() ? { [copy.model]: model.trim() } : {}),
        ...guidedTechnicalSpecifications,
        ...technicalSpecifications,
      },
      description: description.trim(),
      priceSignal: "fair",
      buyerProtection: true,
      serialVerified: false,
      createdLabel: copy.justNow,
      createdAt: new Date().toISOString(),
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
          <p className="required-fields-note">
            <span aria-hidden="true">*</span> {formCopy.required}
          </p>
          <section className="create-listing-section" aria-labelledby="product-details-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">01</span>
              <div>
                <h2 id="product-details-title">{copy.productDetails}</h2>
                <p>{copy.productDetailsHelp}</p>
              </div>
            </div>
            <ProductModelPicker
              key={category}
              category={category}
              locale={locale}
              selectedId={catalogModelId}
              onSelect={(m) => {
                setCatalogModelId(m?.id ?? null);
                if (m) {
                  setBrand(m.brand);
                  setModel([m.name, m.variant].filter(Boolean).join(" · "));
                  if (!title.trim()) setTitle(`${m.brand} ${m.name}`);
                }
              }}
            />
            <div className="create-listing-fields">
              <label className="field-wide">
                <FieldLabel label={copy.productTitle} required requiredText={formCopy.required} />
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
                <FieldLabel label={copy.category} required requiredText={formCopy.required} />
                <select
                  required
                  value={category}
                  onChange={(event) => {
                    const nextCategory = event.target.value as Category;
                    setCategory(nextCategory);
                    setCatalogModelId(null);
                    if (nextCategory !== "pc") setTechnicalDetailsUnknown(false);
                  }}
                >
                  {(
                    [
                      "gpu",
                      "cpu",
                      "memory",
                      "motherboard",
                      "psu",
                      "storage",
                      "case",
                      "cooling",
                      "pc",
                      "other",
                    ] as Category[]
                  ).map((item) => (
                    <option key={item} value={item}>
                      {copy[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldLabel label={copy.condition} required requiredText={formCopy.required} />
                <select required value={condition} onChange={(event) => setCondition(event.target.value as Condition)}>
                  {(["new", "excellent", "good", "fair"] as Condition[]).map((item) => (
                    <option key={item} value={item}>
                      {copy[item === "fair" ? "conditionFair" : item]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <FieldLabel
                  label={`${copy.price} (${MARKETS[market].currency})`}
                  required
                  requiredText={formCopy.required}
                />
                <input
                  required
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="450"
                />
              </label>
              <label>
                <FieldLabel label={copy.brand} requiredText={formCopy.required} optionalText={formCopy.optional} />
                <input
                  value={brand}
                  onChange={(event) => {
                    setBrand(event.target.value);
                    setCatalogModelId(null);
                  }}
                  placeholder="ASUS"
                />
              </label>
              <label>
                <FieldLabel label={copy.model} requiredText={formCopy.required} optionalText={formCopy.optional} />
                <input
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setCatalogModelId(null);
                  }}
                  placeholder="TUF-RTX4070S-O12G-GAMING"
                />
              </label>
            </div>
          </section>

          <section className="create-listing-section" aria-labelledby="technical-details-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">02</span>
              <div>
                <h2 id="technical-details-title">{technicalSectionTitle}</h2>
                <p>{technicalSectionHelp}</p>
              </div>
            </div>
            {category === "pc" && (
              <label className={`unknown-details-toggle${technicalDetailsUnknown ? " is-selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={technicalDetailsUnknown}
                  onChange={(event) => setTechnicalDetailsUnknown(event.target.checked)}
                />
                <span>
                  <strong>{formCopy.unknown}</strong>
                  <small>{formCopy.unknownHelp}</small>
                </span>
              </label>
            )}

            {!technicalDetailsUnknown && (
              <div className="specification-editor">
                {guidedFields.length > 0 && (
                  <div className={`guided-specifications${category === "pc" ? " guided-specifications--pc" : ""}`}>
                    {guidedFields.map((field) => (
                      <label key={field.key}>
                        <FieldLabel label={field.label} requiredText={formCopy.required} />
                        <input
                          value={guidedSpecifications[field.key] ?? ""}
                          onChange={(event) =>
                            setGuidedSpecifications((values) => ({ ...values, [field.key]: event.target.value }))
                          }
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="custom-specifications">
                  {specifications.length > 0 && <h3>{formCopy.customDetails}</h3>}
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
              </div>
            )}
          </section>

          <section className="create-listing-section" aria-labelledby="description-title">
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">03</span>
              <div>
                <h2 id="description-title">
                  <FieldLabel label={copy.description} required requiredText={formCopy.required} />
                </h2>
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
                <h2 id="photos-title">
                  <FieldLabel
                    label={copy.photos}
                    required={photosRequired}
                    requiredText={formCopy.required}
                    optionalText={photosRequired ? undefined : formCopy.optional}
                  />
                </h2>
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
                <FieldLabel label={copy.name} required requiredText={formCopy.required} />
                <input value={user.name} readOnly aria-readonly="true" />
              </label>
              <label>
                <FieldLabel label={copy.publicLocation} required requiredText={formCopy.required} />
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
                <FieldLabel label={copy.postalCode} required requiredText={formCopy.required} />
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
                <FieldLabel label={copy.streetAddress} required requiredText={formCopy.required} />
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
