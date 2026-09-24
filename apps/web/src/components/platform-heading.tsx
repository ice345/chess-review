import type { ReactNode } from "react";

export function PlatformHeading({ chapter, title, children, actions }: { chapter: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return <header className="platform-heading"><div><p className="page-kicker">{chapter}</p><h1>{title}</h1>{children ? <p>{children}</p> : null}</div>{actions && <div className="platform-heading-actions">{actions}</div>}</header>;
}
