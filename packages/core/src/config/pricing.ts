import type { ModelPricing } from "../types/index.js";

/**
 * Pricing lives in the model catalog alongside each model, so a new model and
 * its price are added in one place. Re-exported here for the existing imports.
 */
export { PRICING } from "./catalog.js";

/**
 * Used when a model isn't in the catalog. Zero rates would report an unknown
 * model as free, which is worse than saying nothing in a tool whose whole point
 * is cost comparison — `estimateCost` returns null instead of falling back here.
 */
export const DEFAULT_PRICING: ModelPricing = {
  inputPerMTokens: 0,
  outputPerMTokens: 0,
};
