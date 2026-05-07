import { useEffect } from "react";

/** Listen for Escape key to close modals. Pass a setter that closes the modal. */
export function useModalClose(onClose: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}
