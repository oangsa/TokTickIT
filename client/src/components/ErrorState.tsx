import { Button } from "./Button.js";

interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/*
 * Inline failure state for a card or section (ui-spec Section 6.6). The
 * standalone global error page is a separate screen (Section 27).
 *
 * Callers pass safe copy only; backend text is never rendered here.
 */
export function ErrorState({ title, description, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <div role="alert" className="text-center py-4">
      <h2 className="h6">{title}</h2>
      {description ? <p className="text-secondary">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
