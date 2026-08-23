import { Link, useLocation } from "react-router-dom";

import { useRequester } from "../requester/RequesterProvider.js";

type ErrorStatus = 403 | 404 | 500;

interface ErrorCopy {
  title: string;
  message: string;
}

/*
 * Safe status-specific copy (ui-spec Section 27.3). Ticket ownership, internal
 * identifiers, and raw backend content are never rendered.
 */
const ERROR_COPY: Record<ErrorStatus, ErrorCopy> = {
  403: { title: "Unable to open this page.", message: "You do not have access to the requested resource." },
  404: { title: "Page not found.", message: "The requested resource could not be found." },
  500: { title: "Something went wrong.", message: "Please try again later." },
};

function readStatus(state: unknown): ErrorStatus {
  if (typeof state === "object" && state !== null) {
    const candidate = (state as { status?: unknown }).status;

    if (candidate === 403 || candidate === 404 || candidate === 500) {
      return candidate;
    }
  }

  // Missing or invalid navigation state, including reload and direct navigation.
  return 500;
}

/*
 * Standalone global error screen (ui-spec Section 27). It renders without the
 * requester sidebar and reads only the status from navigation state: Section
 * 27.1 also forbids rendering backend-supplied title or message text, so any
 * such state field is ignored rather than displayed.
 *
 * Section 27.1's `backPath` state field is ignored as well. Section 27.4 already
 * determines the target from the requester context, and honouring a caller-supplied
 * path would turn navigation state into an open redirect.
 */
export default function ErrorPage() {
  const location = useLocation();
  const { requester } = useRequester();
  const status = readStatus(location.state);
  const copy = ERROR_COPY[status];

  // Back never uses browser history: history may return to the same failing
  // route (Section 27.4).
  const backPath = requester === null ? "/requesters" : "/tickets";

  return (
    <main className="tt-main__inner">
      <p className="tt-brand h5">TokTickIT</p>

      <div className="text-center py-5" role="alert">
        <p className="display-5 mb-3">{status}</p>
        <h1 className="h4">{copy.title}</h1>
        <p className="text-secondary">{copy.message}</p>
        <Link className="btn btn-outline-secondary" to={backPath}>
          Back
        </Link>
      </div>
    </main>
  );
}
