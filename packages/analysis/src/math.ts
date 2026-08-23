export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function standardDeviation(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function weightedMean(values: Array<readonly [number, number]>): number | null {
  if (values.length === 0) return null;
  const weight = values.reduce((sum, pair) => sum + pair[1], 0);
  if (weight === 0) return null;
  return values.reduce((sum, pair) => sum + pair[0] * pair[1], 0) / weight;
}

export function harmonicMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.length / values.reduce((sum, value) => sum + 1 / Math.max(1, value), 0);
}
