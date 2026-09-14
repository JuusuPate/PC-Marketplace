import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
}

export function ModalShell({ title, onClose, children, size = "normal" }: ModalShellProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = panel?.closest<HTMLElement>(".modal-backdrop") ?? null;
    const backgroundElements = backdrop?.parentElement
      ? Array.from(backdrop.parentElement.children).filter(
          (element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop,
        )
      : [];
    const previousInertState = backgroundElements.map((element) => [element, element.inert] as const);
    const getFocusableElements = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (element) => element.getClientRects().length > 0,
          )
        : [];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === firstElement || !panel.contains(document.activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    backgroundElements.forEach((element) => {
      element.inert = true;
    });
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    (getFocusableElements()[0] ?? panel)?.focus();

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
      previousInertState.forEach(([element, inert]) => {
        element.inert = inert;
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className={`modal-panel ${size === "wide" ? "modal-panel--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button modal-close" type="button" aria-label="Sulje" onClick={onClose}>
          <Icon name="close" />
        </button>
        {children}
      </section>
    </div>
  );
}
