import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /* For a title that is data rather than prose -- a Ticket Number. */
  titleClassName?: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/*
 * Page title, optional context line, and secondary actions (ui-spec Sections
 * 11.1, 13.1, 20.1). Rendered as a plain container rather than a <header> so it
 * never competes with the shell's banner landmark.
 */
export function PageHeader({ title, titleClassName, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        {eyebrow ? <p className="tt-caption mb-1">{eyebrow}</p> : null}
        <h1 className={`h3 mb-0${titleClassName ? ` ${titleClassName}` : ""}`}>{title}</h1>
        {subtitle ? <p className="text-secondary mb-0 mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="d-flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
