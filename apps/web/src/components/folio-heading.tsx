import type { ReactNode } from "react";
import { BluebirdMotif } from "@chess-review/ui";

/** A chapter opening for the library's quieter, document-oriented pages. */
export function FolioHeading({ chapter, title, children, actions }: {
  chapter: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head folio-heading">
      <div className="folio-heading-copy">
        <p className="page-kicker">{chapter}</p>
        <h1 className="page-display">{title}</h1>
        <p className="page-lede">{children}</p>
      </div>
      <BluebirdMotif kind="feather" className="folio-heading-feather" />
      {actions && <div className="folio-heading-actions">{actions}</div>}
    </header>
  );
}
