import { PRICING } from "../config/pricing.js";
import type { TokenUsage } from "../types/index.js";

/**
 * Estimated USD cost for a request.
 *
 * Returns null when the model isn't priced in the catalog. Reporting an unknown
 * model as "$0.00" would quietly make it look like the cheapest option in a
 * side-by-side comparison, which is the one mistake this tool must not make.
 */
export function estimateCost(model: string, usage: TokenUsage): number | null {
  const pricing = PRICING[model] ?? findFuzzyPricing(model);
  if (!pricing) return null;
  const inputCost = (usage.input / 1_000_000) * pricing.inputPerMTokens;
  const outputCost = (usage.output / 1_000_000) * pricing.outputPerMTokens;
  return roundTo(inputCost + outputCost, 6);
}

/**
 * Matches dated or suffixed variants against their base entry, e.g.
 * "gpt-5.6-terra-2026-08-01" against "gpt-5.6-terra".
 */
function findFuzzyPricing(model: string) {
  const key = Object.keys(PRICING).find(
    (k) => model.startsWith(k) || k.startsWith(model),
  );
  return key ? PRICING[key] : undefined;
}

export function roundTo(n: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
}

export function formatCost(cost: number | null): string {
  if (cost === null) return "n/a";
  if (cost === 0) return "$0.00";
  if (cost < 0.0001) return `$${cost.toExponential(2)}`;
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}
