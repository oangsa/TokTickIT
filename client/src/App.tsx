import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell.js";
import CreateTicket from "./pages/CreateTicket.js";
import ErrorPage from "./pages/ErrorPage.js";
import MyTickets from "./pages/MyTickets.js";
import RequesterSelection from "./pages/RequesterSelection.js";
import RequesterTicketDetail from "./pages/RequesterTicketDetail.js";
import { RequesterGuard } from "./requester/RequesterGuard.js";
import { RequesterProvider, useRequester } from "./requester/RequesterProvider.js";

/* `/` resolves against the stored Requester context (ui-spec Section 5.4). */
function RootRedirect() {
  const { requester } = useRequester();

  return <Navigate to={requester === null ? "/requesters" : "/tickets"} replace />;
}

export default function App() {
  return (
    <RequesterProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Bootstrap and global error routes render without the requester shell. */}
        <Route path="/requesters" element={<RequesterSelection />} />
        <Route path="/error" element={<ErrorPage />} />

        {/*
          The guard sits outside the shell: the shell displays the selected
          Requester, so it must not render at all without a context.
        */}
        <Route element={<RequesterGuard />}>
          <Route element={<AppShell />}>
            <Route path="/tickets" element={<MyTickets />} />
            <Route path="/tickets/new" element={<CreateTicket />} />
            <Route path="/tickets/:publicId" element={<RequesterTicketDetail />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/error" replace state={{ status: 404 }} />} />
      </Routes>
    </RequesterProvider>
  );
}
