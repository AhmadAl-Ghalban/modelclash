import type {
  ModelInfo,
  ProviderName,
  ProviderRequest,
  ProviderResponse,
} from "../types/index.js";

export interface LLMProvider {
  readonly name: ProviderName;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
  streamGenerate?(
    request: ProviderRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse>;
  /**
   * Asks the provider which models it currently offers.
   *
   * Vendors ship models faster than any hardcoded list can track, so callers
   * should prefer this over the offline catalog whenever a credential exists.
   * Throws if the provider is unreachable or the credential is rejected —
   * callers fall back to the catalog.
   */
  listModels?(): Promise<ModelInfo[]>;
}
