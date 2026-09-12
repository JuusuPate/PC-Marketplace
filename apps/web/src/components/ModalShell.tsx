import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "normal" | "wide";
}

export function ModalShell({ title, onClose, children, size = "normal" }: ModalShellProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-panel ${size === "wide" ? "modal-panel--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
