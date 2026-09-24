import type { ReactNode } from "react";

export function DeskEmptyState({ title, children, actions }: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return <section className="desk-empty-state">
    <span className="staff-mark desk-empty-staff" aria-hidden="true" />
    <div><h2>{title}</h2><p>{children}</p><div className="desk-empty-actions">{actions}</div></div>
  </section>;
}
