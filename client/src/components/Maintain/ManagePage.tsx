import type { ReactNode } from "react";

import { PageHeader, type PageHeaderProps } from "./PageHeader.js";

interface ManagePageProps {
  header: PageHeaderProps;
  className?: string;
  children: ReactNode;
}

/** Shared page composition for configured create/edit/view screens. */
export function ManagePage({ header, className, children }: ManagePageProps) {
  return (
    <div className={className}>
      <PageHeader {...header} />
      {children}
    </div>
  );
}

export default ManagePage;
