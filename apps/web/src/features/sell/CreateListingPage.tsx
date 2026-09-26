import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { getSafeListingImageUrl } from "../../components/ListingVisual";
import { MARKETS } from "../../config/markets";
import type { Messages } from "../../i18n/messages/fi";
import type { PreparedListingImage } from "../../lib/listing-images";
import {
  getPublicListingCreationEnabled,
  ListingCreationPausedError,
} from "../../lib/listing-creation-setting-service";
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

type ListingStep = 1 | 2 | 3 | 4 | 5 | 6;

interface ValidationIssue {
  field: string;
  message: string;
  step: ListingStep;
}

type SellerSummary = Pick<Seller, "rating" | "reviewCount" | "completedSales" | "verified">;

export interface CreateListingPageProps {
  copy: Messages;
  locale: Locale;
  market: CountryCode;
  user: DemoUser;
  seller?: SellerSummary;
  initialListing?: Listing;
  initialPickupAddress?: PrivatePickupAddress | null;
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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <small className="field-error" id={id} role="alert">
      {message}
    </small>
  );
}

export function CreateListingPage({
  copy,
  locale,
  market,
  user,
  seller,
  initialListing,
  initialPickupAddress,
  onCancel,
  onPublish,
}: CreateListingPageProps) {
  const runtimeCopy = getRuntimeCopy(locale);
  const formCopy = specificationCopy[locale];
  const initialCategory = initialListing?.category ?? "gpu";
  const initialGuidedFields = getGuidedSpecificationFields(initialCategory, locale);
  const initialReservedSpecificationNames = new Set(
    [copy.brand, copy.model, copy.technicalDetails, ...initialGuidedFields.map((field) => field.label)].map((label) =>
      label.toLocaleLowerCase(),
    ),
  );
  const [title, setTitle] = useState(initialListing?.title ?? "");
  const [category, setCategory] = useState<Category | "">(initialListing ? (initialCategory as Category) : "");
  const [condition, setCondition] = useState<Condition>(initialListing?.condition ?? "good");
  const [price, setPrice] = useState(initialListing ? String(initialListing.priceMinor / 100).replace(".", ",") : "");
  const [brand, setBrand] = useState(initialListing?.brand ?? initialListing?.specs[copy.brand] ?? "");
  const [model, setModel] = useState(initialListing?.specs[copy.model] ?? "");
  const [catalogModelId, setCatalogModelId] = useState<string | null>(initialListing?.catalogModelId ?? null);
  const [guidedSpecifications, setGuidedSpecifications] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialGuidedFields.map((field) => [field.key, initialListing?.specs[field.label] ?? ""])),
  );
  const [specifications, setSpecifications] = useState<SpecificationRow[]>(() =>
    Object.entries(initialListing?.specs ?? {})
      .filter(([name]) => !initialReservedSpecificationNames.has(name.toLocaleLowerCase()))
      .map(([name, value]) => ({ id: crypto.randomUUID(), name, value })),
  );
  const [technicalDetailsUnknown, setTechnicalDetailsUnknown] = useState(
    initialListing?.specs[copy.technicalDetails] === formCopy.unknown,
  );
  const [description, setDescription] = useState(initialListing?.description ?? "");
  const [images, setImages] = useState<PreparedListingImage[]>([]);
  const [city, setCity] = useState(
    initialPickupAddress?.city ?? initialListing?.city ?? user.pickupAddress?.city ?? "",
  );
  const [streetAddress, setStreetAddress] = useState(
    initialPickupAddress?.streetAddress ?? user.pickupAddress?.streetAddress ?? "",
  );
  const [postalCode, setPostalCode] = useState(
    initialPickupAddress?.postalCode ?? user.pickupAddress?.postalCode ?? "",
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<ListingStep>(1);
  const [busy, setBusy] = useState(false);
  const [creationRefresh, setCreationRefresh] = useState(0);
  const [creationState, setCreationState] = useState<"loading" | "enabled" | "paused" | "error">(
    initialListing || backendMode === "demo" ? "enabled" : "loading",
  );
  const existingImages = initialListing?.images ?? [];
  const existingPreviewUrl = getSafeListingImageUrl(existingImages[0]);
  const displayedImageCount = images.length > 0 ? images.length : existingImages.length;
  const photosRequired = backendMode !== "demo" && existingImages.length === 0;
  useEffect(() => {
    if (initialListing || backendMode === "demo") return;
    let current = true;
    setCreationState("loading");
    getPublicListingCreationEnabled().then(
      (enabled) => {
        if (current) setCreationState(enabled ? "enabled" : "paused");
      },
      () => {
        if (current) setCreationState("error");
      },
    );
    return () => {
      current = false;
    };
  }, [initialListing, creationRefresh]);
  const safeCategory = (category || "gpu") as Category;
  const guidedFields = getGuidedSpecificationFields(safeCategory, locale);
  const technicalSectionTitle =
    safeCategory === "pc"
      ? formCopy.pcTitle
      : safeCategory === "other"
        ? formCopy.optionalTitle
        : formCopy.componentTitle;
  const technicalSectionHelp =
    safeCategory === "pc"
      ? formCopy.pcHelp
      : safeCategory === "other"
        ? formCopy.optionalHelp
        : formCopy.componentHelp;
  const numericPrice = Number(price.replace(",", "."));
  const formattedPrice =
    Number.isFinite(numericPrice) && numericPrice > 0
      ? formatMoney(Math.round(numericPrice * 100), MARKETS[market].currency, locale)
      : copy.previewPricePlaceholder;
  const wizardCopy =
    locale === "fi"
      ? {
          steps: ["Kategoria", "Tuote", "Tiedot", "Kuvat", "Sijainti", "Tarkistus"],
          previous: "Takaisin",
          next: "Jatka",
          edit: "Muokkaa",
          step: "Vaihe",
          reviewTitle: "Tarkista ilmoitus",
          reviewHelp: "Varmista vielä tiedot ennen julkaisemista. Pääset takaisin muokkaamaan aiempia vaiheita.",
          titleError: "Kirjoita ilmoitukselle vähintään 5 merkkiä pitkä otsikko.",
          categoryError: "Valitse kategoria ennen jatkamista.",
          priceError: "Anna tuotteelle kelvollinen, nollaa suurempi hinta.",
          descriptionError: (length: number) =>
            `Kirjoita kuvaukseen vähintään 20 merkkiä. Nyt kuvauksessa on ${length} merkkiä.`,
          cityError: "Kirjoita paikkakunta.",
          streetAddressError: "Kirjoita vähintään 5 merkkiä pitkä katuosoite.",
          postalCodeError: "Kirjoita suomalainen postinumero viidellä numerolla.",
          photosSummary: "Kuvia",
          technicalSummary: "Teknisiä tietoja",
          descriptionSummary: "Kuvaus",
          locationSummary: "Sijainti ja myyjä",
          editEyebrow: "OMAN ILMOITUKSEN MUOKKAUS",
          editTitle: "Muokkaa ilmoitusta",
          editIntro:
            "Päivitä ilmoituksen tiedot ja tallenna muutokset. Ilmoituksen tunniste ja myyjän tiedot säilyvät samoina.",
          save: "Tallenna muutokset",
          currentPhotos: "Nykyiset kuvat säilytetään, ellet valitse uusia kuvia.",
          storedPhotos: "Ilmoituksessa olevat kuvat",
          storedPhoto: "Tallennettu",
          replacePhotos: "Vaihda kuvat",
        }
      : {
          steps: ["Category", "Item", "Details", "Photos", "Location", "Review"],
          previous: "Back",
          next: "Continue",
          edit: "Edit",
          step: "Step",
          reviewTitle: "Review your listing",
          reviewHelp: "Check the details before publishing. You can return to any earlier step to make changes.",
          titleError: "Enter a listing title with at least 5 characters.",
          categoryError: "Select a category before continuing.",
          priceError: "Enter a valid price greater than zero.",
          descriptionError: (length: number) =>
            `Write a description with at least 20 characters. It currently has ${length} characters.`,
          cityError: "Enter the city.",
          streetAddressError: "Enter a street address with at least 5 characters.",
          postalCodeError: "Enter a five-digit Finnish postal code.",
          photosSummary: "Photos",
          technicalSummary: "Technical details",
          descriptionSummary: "Description",
          locationSummary: "Location and seller",
          editEyebrow: "EDIT YOUR LISTING",
          editTitle: "Edit listing",
          editIntro: "Update the listing details and save your changes. The listing identity and seller stay the same.",
          save: "Save changes",
          currentPhotos: "Current photos are kept unless you select new ones.",
          storedPhotos: "Photos in this listing",
          storedPhoto: "Saved",
          replacePhotos: "Replace photos",
        };
  const wizardSteps = wizardCopy.steps.map((label, index) => ({ id: (index + 1) as ListingStep, label }));

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
    clearFieldError("specifications");
  };

  const removeSpecification = (id: string) => {
    setSpecifications((rows) => rows.filter((row) => row.id !== id));
    clearFieldError("specifications");
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError("");
  };

  const getValidationIssues = (steps: ListingStep[]): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const includes = (step: ListingStep) => steps.includes(step);

    if (includes(1) && !category) {
      issues.push({ field: "category", message: wizardCopy.categoryError, step: 1 });
    }

    if (includes(2)) {
      if (title.trim().length < 5) issues.push({ field: "title", message: wizardCopy.titleError, step: 2 });
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        issues.push({ field: "price", message: wizardCopy.priceError, step: 2 });
      }
    }

    if (includes(3)) {
      const incompleteSpecification =
        !technicalDetailsUnknown &&
        specifications.some(
          (row) =>
            (row.name.trim().length > 0 || row.value.trim().length > 0) && (!row.name.trim() || !row.value.trim()),
        );
      if (incompleteSpecification) {
        issues.push({ field: "specifications", message: copy.specIncomplete, step: 3 });
      }
      if (description.trim().length < 20) {
        issues.push({
          field: "description",
          message: wizardCopy.descriptionError(description.trim().length),
          step: 3,
        });
      }
    }

    if (includes(4) && photosRequired && images.length === 0) {
      issues.push({ field: "photos", message: formCopy.photoRequired, step: 4 });
    }

    if (includes(5)) {
      if (!city.trim()) issues.push({ field: "city", message: wizardCopy.cityError, step: 5 });
      if (!/^\d{5}$/.test(postalCode.trim())) {
        issues.push({ field: "postalCode", message: wizardCopy.postalCodeError, step: 5 });
      }
      if (streetAddress.trim().length < 5) {
        issues.push({ field: "streetAddress", message: wizardCopy.streetAddressError, step: 5 });
      }
    }

    return issues;
  };

  const showValidationIssues = (issues: ValidationIssue[]) => {
    const nextErrors = Object.fromEntries(issues.map((issue) => [issue.field, issue.message]));
    setFieldErrors(nextErrors);
    setError(issues[0]?.message ?? "");
    if (issues[0]) {
      setCurrentStep(issues[0].step);
      window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-listing-field="${issues[0].field}"]`)?.focus();
      }, 0);
    }
  };

  const moveToStep = (step: ListingStep) => {
    if (step === currentStep || (!initialListing && step > currentStep)) return;
    setCurrentStep(step);
    setError("");
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentStep < 6) {
      const issues = getValidationIssues([currentStep]);
      if (issues.length > 0) {
        showValidationIssues(issues);
        return;
      }
      setFieldErrors({});
      setError("");
      setCurrentStep((current) => (current + 1) as ListingStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!initialListing && creationState !== "enabled") return;

    const issues = getValidationIssues([1, 2, 3, 4, 5]);
    if (issues.length > 0) {
      showValidationIssues(issues);
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
      ...(initialListing ?? {}),
      id: initialListing?.id ?? `listing-${Date.now()}`,
      title: title.trim(),
      subtitle: `${identity || copy[safeCategory]} · ${conditionLabel}`,
      category: safeCategory,
      catalogModelId,
      brand: brand.trim(),
      priceMinor: Math.round(numericPrice * 100),
      currency: MARKETS[market].currency,
      condition,
      city: city.trim(),
      seller: initialListing?.seller ?? {
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
      priceSignal: initialListing?.priceSignal ?? "fair",
      buyerProtection: initialListing?.buyerProtection ?? true,
      serialVerified: initialListing?.serialVerified ?? false,
      createdLabel: initialListing?.createdLabel ?? copy.justNow,
      createdAt: initialListing?.createdAt ?? new Date().toISOString(),
      visual: visualByCategory[safeCategory],
      images: existingImages,
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
      if (caught instanceof ListingCreationPausedError) {
        setCreationState("paused");
        setError("");
      } else setError(caught instanceof Error ? caught.message : runtimeCopy.listingError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="create-listing-page" aria-labelledby="create-listing-title">
      <header className="create-listing-page__header">
        <div>
          <span className="section-kicker">{initialListing ? wizardCopy.editEyebrow : copy.createListingEyebrow}</span>
          <h1 id="create-listing-title">{initialListing ? wizardCopy.editTitle : copy.sellTitle}</h1>
          <p>{initialListing ? wizardCopy.editIntro : copy.createListingIntro}</p>
        </div>
        <button className="button button--outline" type="button" onClick={onCancel} disabled={busy}>
          <Icon name="close" />
          {copy.cancel}
        </button>
      </header>

      {!initialListing && creationState !== "enabled" && (
        <div className="form-error create-listing-form__error" role={creationState === "loading" ? "status" : "alert"}>
          <p>
            {creationState === "loading"
              ? runtimeCopy.creationCheck
              : creationState === "paused"
                ? runtimeCopy.creationPaused
                : runtimeCopy.creationCheckError}
          </p>
          {creationState !== "loading" && (
            <button
              type="button"
              className="button button--outline"
              onClick={() => setCreationRefresh((value) => value + 1)}
            >
              {runtimeCopy.retryCreationCheck}
            </button>
          )}
        </div>
      )}

      <nav
        className="listing-wizard"
        aria-label={
          locale === "fi"
            ? initialListing
              ? "Ilmoituksen muokkauksen vaiheet"
              : "Ilmoituksen luonnin vaiheet"
            : initialListing
              ? "Listing editing steps"
              : "Listing creation steps"
        }
      >
        <ol>
          {wizardSteps.map((step) => (
            <li
              className={`${step.id === currentStep ? "is-current" : ""}${step.id < currentStep ? " is-complete" : ""}`}
              key={step.id}
            >
              <button
                type="button"
                onClick={() => moveToStep(step.id)}
                disabled={!initialListing && step.id > currentStep}
                aria-current={step.id === currentStep ? "step" : undefined}
              >
                <span>{step.id < currentStep ? "✓" : step.id}</span>
                <strong>{step.label}</strong>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <form className="create-listing-form" onSubmit={submit} noValidate>
        <div className="create-listing-form__main">
          <p className="required-fields-note">
            <span aria-hidden="true">*</span> {formCopy.required}
          </p>
          <section
            className="create-listing-section"
            aria-labelledby="category-selection-title"
            hidden={currentStep !== 1}
          >
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">01</span>
              <div>
                <h2 id="category-selection-title">{copy.category}</h2>
                <p>Valitse ilmoituksen kategoria ennen jatkamista.</p>
              </div>
            </div>
            <div className="create-listing-fields">
              <label className="field-wide">
                <FieldLabel label={copy.category} required requiredText={formCopy.required} />
                <select
                  required
                  value={category}
                  onChange={(event) => {
                    const nextCategory = event.target.value as Category;
                    setCategory(nextCategory || "");
                    setCatalogModelId(null);
                    if (nextCategory && nextCategory !== "pc") setTechnicalDetailsUnknown(false);
                    clearFieldError("category");
                  }}
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={fieldErrors.category ? "category-error" : undefined}
                  data-listing-field="category"
                >
                  <option value="">Valitse kategoria</option>
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
                <FieldError id="category-error" message={fieldErrors.category} />
              </label>
            </div>
          </section>

          <section
            className="create-listing-section"
            aria-labelledby="product-details-title"
            hidden={currentStep !== 2}
          >
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">02</span>
              <div>
                <h2 id="product-details-title">{copy.productDetails}</h2>
                <p>{copy.productDetailsHelp}</p>
              </div>
            </div>
            <ProductModelPicker
              key={safeCategory}
              category={safeCategory}
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
                  onChange={(event) => {
                    setTitle(event.target.value);
                    clearFieldError("title");
                  }}
                  placeholder="ASUS TUF RTX 4070 SUPER"
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? "title-error" : undefined}
                  data-listing-field="title"
                />
                <FieldError id="title-error" message={fieldErrors.title} />
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
                  onChange={(event) => {
                    setPrice(event.target.value);
                    clearFieldError("price");
                  }}
                  placeholder="450"
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={fieldErrors.price ? "price-error" : undefined}
                  data-listing-field="price"
                />
                <FieldError id="price-error" message={fieldErrors.price} />
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

          <section
            className="create-listing-section"
            aria-labelledby="technical-details-title"
            hidden={currentStep !== 3}
          >
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">03</span>
              <div>
                <h2 id="technical-details-title">{technicalSectionTitle}</h2>
                <p>{technicalSectionHelp}</p>
              </div>
            </div>
            <div tabIndex={-1} data-listing-field="specifications">
              <FieldError id="specifications-error" message={fieldErrors.specifications} />
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

          <section className="create-listing-section" aria-labelledby="description-title" hidden={currentStep !== 3}>
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">04</span>
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
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearFieldError("description");
                }}
                placeholder={copy.descriptionHelp}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? "description-error" : undefined}
                data-listing-field="description"
              />
              <small>{description.length} / 4000</small>
            </div>
            <FieldError id="description-error" message={fieldErrors.description} />
          </section>

          <section className="create-listing-section" aria-labelledby="photos-title" hidden={currentStep !== 4}>
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">05</span>
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
            <div tabIndex={-1} data-listing-field="photos">
              <ImagePicker
                copy={copy}
                images={images}
                existingImages={existingImages}
                existingImagesTitle={wizardCopy.storedPhotos}
                existingImageLabel={wizardCopy.storedPhoto}
                replacePhotosLabel={wizardCopy.replacePhotos}
                alt={title}
                mode={backendMode}
                disabled={busy}
                onChange={(nextImages) => {
                  setImages(nextImages);
                  clearFieldError("photos");
                }}
              />
              {initialListing && existingImages.length > 0 && images.length === 0 && (
                <p className="existing-images-note">{wizardCopy.currentPhotos}</p>
              )}
              <FieldError id="photos-error" message={fieldErrors.photos} />
            </div>
          </section>

          <section className="create-listing-section" aria-labelledby="seller-details-title" hidden={currentStep !== 5}>
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">06</span>
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
                  onChange={(event) => {
                    setCity(event.target.value);
                    clearFieldError("city");
                  }}
                  placeholder="Helsinki"
                  aria-invalid={Boolean(fieldErrors.city)}
                  aria-describedby={fieldErrors.city ? "city-error" : undefined}
                  data-listing-field="city"
                />
                <small>{copy.publicLocationHelp}</small>
                <FieldError id="city-error" message={fieldErrors.city} />
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
                  onChange={(event) => {
                    setPostalCode(event.target.value);
                    clearFieldError("postalCode");
                  }}
                  placeholder="00100"
                  aria-invalid={Boolean(fieldErrors.postalCode)}
                  aria-describedby={fieldErrors.postalCode ? "postal-code-error" : undefined}
                  data-listing-field="postalCode"
                />
                <FieldError id="postal-code-error" message={fieldErrors.postalCode} />
              </label>
              <label className="field-wide">
                <FieldLabel label={copy.streetAddress} required requiredText={formCopy.required} />
                <input
                  required
                  autoComplete="street-address"
                  value={streetAddress}
                  onChange={(event) => {
                    setStreetAddress(event.target.value);
                    clearFieldError("streetAddress");
                  }}
                  placeholder={copy.streetAddressPlaceholder}
                  aria-invalid={Boolean(fieldErrors.streetAddress)}
                  aria-describedby={fieldErrors.streetAddress ? "street-address-error" : undefined}
                  data-listing-field="streetAddress"
                />
                <FieldError id="street-address-error" message={fieldErrors.streetAddress} />
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

          <section className="create-listing-section" aria-labelledby="review-listing-title" hidden={currentStep !== 6}>
            <div className="create-listing-section__heading">
              <span className="create-listing-section__number">07</span>
              <div>
                <h2 id="review-listing-title">{wizardCopy.reviewTitle}</h2>
                <p>{wizardCopy.reviewHelp}</p>
              </div>
            </div>
            <div className="listing-review-grid">
              <section>
                <span>{wizardCopy.steps[0]}</span>
                <strong>{copy[safeCategory]}</strong>
                <p>{copy[condition === "fair" ? "conditionFair" : condition]} · {formattedPrice}</p>
                <button type="button" onClick={() => moveToStep(1)}>
                  {wizardCopy.edit}
                </button>
              </section>
              <section>
                <span>{wizardCopy.steps[1]}</span>
                <strong>{title}</strong>
                <p>
                  {copy[safeCategory]} · {copy[condition === "fair" ? "conditionFair" : condition]} · {formattedPrice}
                </p>
                <button type="button" onClick={() => moveToStep(2)}>
                  {wizardCopy.edit}
                </button>
              </section>
              <section>
                <span>{wizardCopy.technicalSummary}</span>
                <strong>
                  {technicalDetailsUnknown
                    ? formCopy.unknown
                    : `${Object.values(guidedSpecifications).filter((value) => value.trim()).length + specifications.filter((row) => row.name.trim() && row.value.trim()).length} ${wizardCopy.technicalSummary.toLocaleLowerCase()}`}
                </strong>
                <p className="listing-review-grid__description">{description}</p>
                <button type="button" onClick={() => moveToStep(3)}>
                  {wizardCopy.edit}
                </button>
              </section>
              <section>
                <span>{wizardCopy.photosSummary}</span>
                <strong>{displayedImageCount}</strong>
                <p>{displayedImageCount > 0 ? `${displayedImageCount} / 5` : formCopy.optional}</p>
                <button type="button" onClick={() => moveToStep(4)}>
                  {wizardCopy.edit}
                </button>
              </section>
              <section>
                <span>{wizardCopy.locationSummary}</span>
                <strong>{user.name}</strong>
                <p>
                  {streetAddress}, {postalCode} {city}
                </p>
                <button type="button" onClick={() => moveToStep(5)}>
                  {wizardCopy.edit}
                </button>
              </section>
            </div>
          </section>

          {error && (
            <p className="form-error create-listing-form__error" role="alert">
              {error}
            </p>
          )}

          <div className="listing-wizard__actions">
            <button
              className="button button--outline"
              type="button"
              onClick={() => moveToStep((currentStep - 1) as ListingStep)}
              disabled={currentStep === 1 || busy}
            >
              {wizardCopy.previous}
            </button>
            <span>
              {wizardCopy.step} {currentStep} / {wizardSteps.length}
            </span>
            <button
              className="button button--primary"
              type="submit"
              disabled={busy || (!initialListing && currentStep === wizardSteps.length && creationState !== "enabled")}
            >
              {currentStep === wizardSteps.length
                ? busy
                  ? runtimeCopy.publishing
                  : initialListing
                    ? wizardCopy.save
                    : runtimeCopy.publish
                : wizardCopy.next}
              <Icon name="arrow" />
            </button>
          </div>
        </div>

        <aside className="create-listing-preview" aria-labelledby="listing-preview-title">
          <div className="create-listing-preview__sticky">
            <span className="section-kicker">{copy.listingPreview}</span>
            <h2 id="listing-preview-title">{title.trim() || copy.previewTitlePlaceholder}</h2>
            <p>{copy.reviewBeforePublish}</p>
            <div className={`create-listing-preview__image visual--${visualByCategory[safeCategory]}`}>
              {images[0] ? (
                <img src={images[0].previewUrl} alt={images[0].alt || title} />
              ) : existingPreviewUrl ? (
                <img src={existingPreviewUrl} alt={existingImages[0]?.alt || title} />
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
            <button className="button button--ghost button--full" type="button" onClick={onCancel} disabled={busy}>
              {copy.cancel}
            </button>
          </div>
        </aside>
      </form>
    </section>
  );
}
