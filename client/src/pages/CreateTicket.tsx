import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";

/* Placeholder for Create Ticket. Issue 21 adds the form and Attachment pre-upload. */
export default function CreateTicket() {
  return (
    <>
      <PageHeader title="Create Ticket" />
      <Card>
        <p className="text-secondary mb-0">The ticket form is added in Issue 21.</p>
      </Card>
    </>
  );
}
