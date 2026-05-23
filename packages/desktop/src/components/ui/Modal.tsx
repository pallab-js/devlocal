import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /** Width class, defaults to "max-w-md" */
  width?: string;
}

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function Modal({ open, onClose, title, children, className, width = "max-w-md" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Save the element that triggered this modal so we can restore focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      // Auto-focus first focusable element in the dialog
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
        first?.focus();
      });
    } else {
      // Restore focus to the triggering element
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    }
  }, [open]);

  // Focus trap: keep Tab / Shift+Tab within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
      ).filter((el) => !el.closest("[aria-hidden]"));

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      aria-hidden={!open}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full bg-surface border border-border rounded-xl shadow-2xl",
          "max-h-[88vh] overflow-auto",
          "animate-[zoom-in_0.18s_cubic-bezier(0.16,1,0.3,1)]",
          width,
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-hi rounded-t-xl">
            <h2 className="text-[15px] font-bold text-text m-0">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="text-text-3 hover:text-text transition-colors bg-transparent border-none p-1 rounded cursor-pointer hover:bg-surface-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Lightweight confirm dialog built on top of Modal.
 */
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  loading,
}: ConfirmModalProps) {
  const colorMap = {
    danger: {
      btn: "text-error bg-error-dim border-error-border hover:bg-error/20",
    },
    warning: {
      btn: "text-orange bg-orange-dim border-orange-border hover:bg-orange/20",
    },
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-[13px] text-text-3 mb-5 leading-relaxed">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="text-[12px] px-3.5 py-1.5 rounded-md font-mono font-semibold border text-text-2 bg-surface-2 border-border hover:bg-surface-3 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            "text-[12px] px-3.5 py-1.5 rounded-md font-mono font-semibold border transition-colors cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            colorMap[variant].btn,
          )}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {confirmLabel}…
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
