import { PageHeader } from "../../components/Maintain/PageHeader.js";

export default function UnavailablePage({ title }: { title: string }) {
  return <><PageHeader title={title} subtitle="This area will be available when its workflow is enabled." /><div className="alert alert-info" role="status">No records are loaded yet.</div></>;
}
