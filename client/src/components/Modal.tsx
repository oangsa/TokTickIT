import { ReactNode, useCallback, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton.js";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "lg";
  closeLabel?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
 * Modal dialog (ui-spec Sections 3.3, 29.5, 29.6). Opening moves focus into the
 * dialog, closing returns it to the invoking control, Escape and the backdrop
 * close it, and Tab is trapped inside.
 *
 * The dialog itself is `tabIndex={-1}`. Without it, clicking non-focusable
 * content (body prose, a table cell) sends focus to `document.body`, which is
 * outside this subtree: the keydown handler below would never fire and both
 * Escape and the Tab trap would silently stop working.
 *
 * Bootstrap's JavaScript is deliberately not used: the shell already manages its
 * own overlay state, and a React-owned dialog keeps focus behaviour testable.
 */
export function Modal({ open, title, onClose, children, footer, size, closeLabel = "Close dialog" }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<Element | null>(null);

  const focusables = useCallback(
    () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    invokerRef.current = document.activeElement;
    (focusables()[0] ?? dialogRef.current)?.focus();

    /*
     * Bootstrap 5 ships no `.modal-open` rule; it locks scrolling from its own
     * JavaScript, which this component does not use. Setting the style directly
     * is what actually stops the page scrolling behind the dialog.
     */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      (invokerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, focusables]);

  /*
   * The dismiss handler belongs on `.modal`, not on `.modal-backdrop`: Bootstrap
   * gives `.modal` z-index 1055 over the backdrop's 1050 and sizes it to the
   * whole viewport, so the backdrop never receives a click. `.modal-dialog` is
   * `pointer-events: none`, so a click on the dimmed area targets `.modal`
   * itself. `mousedown` with the target check, not `click`: a drag that starts
   * inside the dialog and releases outside must not dismiss it.
   */
  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const elements = focusables();

    if (elements.length === 0) {
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) {
    return null;
  }

  return createPortal(
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" onKeyDown={handleKeyDown} onMouseDown={handleMouseDown}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={["modal-dialog", "modal-dialog-centered", size ? `modal-${size}` : null]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h2 id={titleId} className="modal-title h5">
                {title}
              </h2>
              <IconButton label={closeLabel} onClick={onClose}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
