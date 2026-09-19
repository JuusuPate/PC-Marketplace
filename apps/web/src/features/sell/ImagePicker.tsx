import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Icon } from "../../components/Icon";
import { getSafeListingImageUrl } from "../../components/ListingVisual";
import type { Messages } from "../../i18n/messages/fi";
import {
  ListingImageError,
  prepareListingImages,
  releasePreparedListingImages,
  type PreparedListingImage,
} from "../../lib/listing-images";
import type { ListingImage } from "../../types";

const MAX_IMAGES = 5;

interface ImagePickerProps {
  copy: Messages;
  images: PreparedListingImage[];
  existingImages?: ListingImage[];
  existingImagesTitle?: string;
  existingImageLabel?: string;
  replacePhotosLabel?: string;
  alt: string;
  mode: "demo" | "supabase";
  disabled?: boolean;
  onChange: (images: PreparedListingImage[]) => void;
}

function getImageError(copy: Messages, error: unknown) {
  if (!(error instanceof ListingImageError)) {
    return copy.imageProcessingFailed;
  }

  switch (error.code) {
    case "too_many_images":
      return copy.imageTooMany;
    case "empty_file":
      return copy.imageEmpty;
    case "unsupported_type":
      return copy.imageUnsupported;
    case "source_too_large":
    case "output_too_large":
      return copy.imageTooLarge;
    case "decode_failed":
      return copy.imageDecodeFailed;
    default:
      return copy.imageProcessingFailed;
  }
}

function withSortOrder(images: PreparedListingImage[]) {
  return images.map((image, sortOrder) => ({ ...image, sortOrder }));
}

export function ImagePicker({
  copy,
  images,
  existingImages = [],
  existingImagesTitle = "Tallennetut kuvat",
  existingImageLabel = "Tallennettu",
  replacePhotosLabel,
  alt,
  mode,
  disabled = false,
  onChange,
}: ImagePickerProps) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const latestImagesRef = useRef(images);

  useEffect(() => {
    latestImagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      releasePreparedListingImages(latestImagesRef.current);
    },
    [],
  );

  const addFiles = async (files: File[] | FileList) => {
    if (disabled || busy || files.length === 0) return;

    setBusy(true);
    setError("");
    try {
      const prepared = await prepareListingImages(files, {
        mode,
        alt: alt.trim(),
        startIndex: images.length,
      });
      onChange(withSortOrder([...images, ...prepared]));
    } catch (caught) {
      setError(getImageError(copy, caught));
    } finally {
      setBusy(false);
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) void addFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    const image = images[index];
    if (!image) return;
    releasePreparedListingImages([image]);
    onChange(withSortOrder(images.filter((_, imageIndex) => imageIndex !== index)));
    setError("");
  };

  const makeCover = (index: number) => {
    const image = images[index];
    if (!image || index === 0) return;
    onChange(withSortOrder([image, ...images.filter((_, imageIndex) => imageIndex !== index)]));
  };

  const atLimit = images.length >= MAX_IMAGES;
  const storedImages = existingImages.filter((image) => getSafeListingImageUrl(image));
  const showingStoredImages = images.length === 0 && storedImages.length > 0;
  const visibleImageCount = showingStoredImages ? storedImages.length : images.length;

  return (
    <div className="image-picker">
      <div
        className={`image-picker__dropzone ${dragging ? "is-dragging" : ""} ${atLimit ? "is-full" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!atLimit && !disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="image-picker__input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || busy || atLimit}
          onChange={handleInput}
        />
        <div className="image-picker__icon" aria-hidden="true">
          <Icon name="plus" />
        </div>
        <strong>{copy.dropPhotos}</strong>
        <span>{copy.photoFormats}</span>
        <button
          className="button button--outline"
          type="button"
          disabled={disabled || busy || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="plus" />
          {busy ? "…" : showingStoredImages && replacePhotosLabel ? replacePhotosLabel : copy.addPhotos}
        </button>
        <small>
          {visibleImageCount} / {MAX_IMAGES}
        </small>
      </div>

      {error && (
        <p className="form-error image-picker__error" role="alert">
          {error}
        </p>
      )}

      {showingStoredImages && (
        <section className="image-picker__stored" aria-labelledby="stored-listing-images-title">
          <div className="image-picker__stored-heading">
            <strong id="stored-listing-images-title">{existingImagesTitle}</strong>
            <span>
              {storedImages.length} / {MAX_IMAGES}
            </span>
          </div>
          <ol className="image-picker__previews" aria-live="polite">
            {storedImages.map((image, index) => (
              <li className="image-picker__preview image-picker__preview--stored" key={image.id || image.url}>
                <img src={getSafeListingImageUrl(image) ?? undefined} alt={image.alt || alt} />
                <span className="image-picker__cover-badge">{index === 0 ? copy.coverPhoto : existingImageLabel}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {images.length > 0 && (
        <ol className="image-picker__previews" aria-live="polite">
          {images.map((image, index) => (
            <li className="image-picker__preview" key={image.id}>
              <img src={image.previewUrl} alt={image.alt || alt} />
              {index === 0 ? (
                <span className="image-picker__cover-badge">{copy.coverPhoto}</span>
              ) : (
                <button className="image-picker__cover-button" type="button" onClick={() => makeCover(index)}>
                  {copy.makeCover}
                </button>
              )}
              <button
                className="image-picker__remove"
                type="button"
                aria-label={`${copy.removePhoto}: ${index + 1}`}
                onClick={() => removeImage(index)}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
