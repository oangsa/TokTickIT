import { useParams } from "react-router-dom";

import { Card } from "../components/Card.js";
import { PageHeader } from "../components/PageHeader.js";

/* Placeholder for Requester Ticket Detail. Issue 23 adds the read-only detail and ownership handling. */
export default function RequesterTicketDetail() {
  const { publicId } = useParams();

  return (
    <>
      <PageHeader title="Ticket Detail" eyebrow={publicId} />
      <Card>
        <p className="text-secondary mb-0">Ticket detail is added in Issue 23.</p>
      </Card>
    </>
  );
}
