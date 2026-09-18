import { ProviderMark, providerLabel, type ProviderKind } from "@chess-review/ui";

export function SourceChip({ provider }: { provider: ProviderKind }) {
  return (
    <span className="source-chip">
      <ProviderMark provider={provider} decorative />
      {providerLabel(provider)}
    </span>
  );
}
