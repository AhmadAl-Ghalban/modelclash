import { PRICING, DEFAULT_PRICING } from "../config/pricing.js";
import type { TokenUsage } from "../types/index.js";

export function estimateCost(model: string, usage: TokenUsage): number {
  const pricing = PRICING[model] ?? findFuzzyPricing(model) ?? DEFAULT_PRICING;
  const inputCost = (usage.input / 1_000_000) * pricing.inputPerMTokens;
  const outputCost = (usage.output / 1_000_000) * pricing.outputPerMTokens;
  return roundTo(inputCost + outputCost, 6);
}

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

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.0001) return `$${cost.toExponential(2)}`;
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}
