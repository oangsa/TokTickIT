import {
  ButtonHTMLAttributes,
  FocusEvent,
  MouseEvent,
  ReactNode,
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

/*
 * Icon-only controls must carry BOTH an accessible programmatic name and a
 * visible hover/focus label; neither alone is sufficient (ui-spec Section 29.8).
 *
 * `aria-label` supplies the name; the tooltip supplies the sighted-user label
 * on hover and keyboard focus. It is deliberately NOT wired up with
 * `aria-describedby`: the tooltip repeats the name to a screen reader and is
 * only present while visible.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, type = "button", children, onBlur, onFocus, onMouseEnter, onMouseLeave, ...rest },
  ref
) {
  const classes = ["btn", "tt-icon-btn", className].filter(Boolean).join(" ");
  const hostRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const showTooltip = hovered || focused;

  useLayoutEffect(() => {
    if (!showTooltip) {
      setTooltipPosition(null);
      return;
    }

    function updateTooltipPosition() {
      const host = hostRef.current;
      const tooltip = tooltipRef.current;

      if (!host || !tooltip) {
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const edge = 8;
      const gap = 6;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxLeft = Math.max(edge, viewportWidth - tooltipRect.width - edge);
      const left = Math.min(Math.max(edge, hostRect.left), maxLeft);
      const fitsBelow = hostRect.bottom + gap + tooltipRect.height <= viewportHeight - edge;
      const top = fitsBelow
        ? hostRect.bottom + gap
        : Math.max(edge, hostRect.top - tooltipRect.height - gap);

      setTooltipPosition({ top, left });
    }

    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [label, showTooltip]);

  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    setFocused(false);
    onBlur?.(event);
  }

  function handleMouseEnter(event: MouseEvent<HTMLButtonElement>) {
    setHovered(true);
    onMouseEnter?.(event);
  }

  function handleMouseLeave(event: MouseEvent<HTMLButtonElement>) {
    setHovered(false);
    onMouseLeave?.(event);
  }

  const tooltip =
    showTooltip && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            className="tt-tip"
            style={{
              top: tooltipPosition?.top ?? 0,
              left: tooltipPosition?.left ?? 0,
              visibility: tooltipPosition ? "visible" : "hidden",
            }}
          >
            {label}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <span ref={hostRef} className="tt-tip-host">
        <button
          ref={ref}
          type={type}
          className={classes}
          {...rest}
          aria-label={label}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </button>
      </span>
      {tooltip}
    </>
  );
});
