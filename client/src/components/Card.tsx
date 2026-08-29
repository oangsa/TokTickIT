import { ReactNode, useId } from "react";

interface CardProps {
  title?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/* White bordered surface on the quiet page background (ui-spec Sections 2, 3.3). */
export function Card({ title, actions, className, children }: CardProps) {
  const titleId = useId();
  const classes = ["card", className].filter(Boolean).join(" ");
  const body = (
    <>
      {title ? (
        <div className="card-header bg-transparent d-flex justify-content-between align-items-center gap-3">
          <h2 id={titleId} className="tt-section-title mb-0">
            {title}
          </h2>
          {actions}
        </div>
      ) : null}
      <div className="card-body">{children}</div>
    </>
  );

  if (title) {
    return (
      <section className={classes} aria-labelledby={titleId}>
        {body}
      </section>
    );
  }

  return <div className={classes}>{body}</div>;
}
