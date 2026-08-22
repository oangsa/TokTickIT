import { Card } from "../components/Card.js";
import { EmptyState } from "../components/EmptyState.js";
import { PageHeader } from "../components/PageHeader.js";

/* Placeholder for My Tickets. Issue 22 adds search, filters, the table, and pagination. */
export default function MyTickets() {
  return (
    <>
      <PageHeader title="My Tickets" />
      <Card>
        <EmptyState title="No tickets yet." description="Ticket listing is added in Issue 22." />
      </Card>
    </>
  );
}
