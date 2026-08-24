import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/*
 * One shared empty state; the meaning and the action come from props
 * (ui-spec Section 32).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="tt-empty-state">
      <h2 className="h5">{title}</h2>
      {description ? <p className="text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
