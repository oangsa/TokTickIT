import { FormHTMLAttributes, ReactNode } from "react";

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

/**
 * Shared form boundary for the field validation contract. Native `required`
 * remains available for semantics, while submit handling owns the visible
 * field errors and first-invalid focus (ui-spec Section 8.2).
 */
export function Form({ children, className, ...props }: FormProps) {
  return (
    <form {...props} className={["tt-stack", className].filter(Boolean).join(" ")} noValidate>
      {children}
    </form>
  );
}
