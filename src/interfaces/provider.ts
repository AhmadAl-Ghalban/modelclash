import type {
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
}
