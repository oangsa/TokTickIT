import { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-outline-secondary",
  tertiary: "btn-link tt-btn-tertiary",
  destructive: "btn-danger",
};

/*
 * Button hierarchy from ui-spec Section 10. A busy button stays disabled, keeps
 * its original action text, and reserves the spinner slot at all times so the
 * layout does not shift when it starts working (Section 10.6).
 */
export function Button({
  variant = "secondary",
  busy = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["btn", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      <span className="tt-btn__spinner" aria-hidden="true">
        {busy ? <span className="spinner-border spinner-border-sm" /> : null}
      </span>
      {children}
    </button>
  );
}
