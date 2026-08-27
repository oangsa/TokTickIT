import { Navigate, Outlet } from "react-router-dom";

import { useRequester } from "./RequesterProvider.js";

/*
 * Guarded routes redirect before any requester-specific data renders
 * (ui-spec Section 5.4). The guard sits outside the application shell because
 * the shell itself displays the selected Requester name.
 */
export function RequesterGuard() {
  const { requester } = useRequester();

  if (requester === null) {
    return <Navigate to="/requesters" replace />;
  }

  return <Outlet />;
}
