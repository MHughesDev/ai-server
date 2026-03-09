/**
 * Token estimation utilities for context budgeting.
 * L2-06: Token-based context capping for retrieval.
 *
 * Approximation: 1 token ≈ 4 characters for English text.
 * This is a conservative estimate (actual ratio varies by model and text).
 * @see https://platform.openai.com/tokenizer
 */

/** Average characters per token for rough estimation */
export const AVG_CHARS_PER_TOKEN = 4;

/** Default max tokens for context budget */
export const DEFAULT_MAX_CONTEXT_TOKENS = 1000; // ~4000 chars

/**
 * Estimate token count from text.
 * Uses a simple character-based heuristic for performance.
 * PRODUCTION: Replace with model-specific tokenizer (e.g., tiktoken) for accuracy.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;
  // Simple approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

/**
 * Estimate token count from multiple text chunks.
 */
export function estimateTotalTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokenCount(text), 0);
}

/**
 * Options for token-bounded context building.
 */
export interface TokenBoundedContextOptions {
  /** Maximum tokens allowed in context */
  maxTokens: number;
  /** Separator between chunks */
  separator?: string;
  /** Whether to include partial chunks if they fit */
  allowPartialChunks?: boolean;
  /** Estimated tokens for the separator */
  separatorTokenEstimate?: number;
}

/**
 * Result of token-bounded context building.
 */
export interface TokenBoundedContextResult {
  /** The assembled context text */
  contextText: string;
  /** Indices of chunks that were included */
  includedIndices: number[];
  /** Total estimated tokens in the result */
  totalTokens: number;
  /** Whether any chunks were truncated */
  wasTruncated: boolean;
}

/**
 * Build context from chunks, capping by token budget.
 * More accurate than character-based capping for LLM context windows.
 */
export function buildTokenBoundedContext(
  chunks: Array<{ text: string; [key: string]: unknown }>,
  options: TokenBoundedContextOptions
): TokenBoundedContextResult {
  const {
    maxTokens,
    separator = "\n\n",
    allowPartialChunks = true,
    separatorTokenEstimate = estimateTokenCount(separator),
  } = options;

  if (maxTokens <= 0 || chunks.length === 0) {
    return {
      contextText: "",
      includedIndices: [],
      totalTokens: 0,
      wasTruncated: false,
    };
  }

  const parts: string[] = [];
  const includedIndices: number[] = [];
  let totalTokens = 0;
  let wasTruncated = false;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkText = chunk.text?.trim() ?? "";
    if (!chunkText) continue;

    const chunkTokens = estimateTokenCount(chunkText);
    const delimiterTokens = parts.length === 0 ? 0 : separatorTokenEstimate;
    const remainingTokens = maxTokens - totalTokens;

    if (remainingTokens <= 0) break;

    // Check if the whole chunk fits
    if (chunkTokens + delimiterTokens <= remainingTokens) {
      parts.push(parts.length === 0 ? chunkText : `${separator}${chunkText}`);
      includedIndices.push(i);
      totalTokens += delimiterTokens + chunkTokens;
      continue;
    }

    // Chunk doesn't fit entirely - try partial if allowed
    if (allowPartialChunks && remainingTokens > delimiterTokens) {
      const availableForContent = remainingTokens - delimiterTokens;
      const maxChars = availableForContent * AVG_CHARS_PER_TOKEN;
      const partialText = chunkText.slice(0, maxChars);

      if (partialText.length > 0) {
        parts.push(parts.length === 0 ? partialText : `${separator}${partialText}`);
        includedIndices.push(i);
        totalTokens = maxTokens;
        wasTruncated = true;
      }
      break;
    }

    // Can't fit anything more
    break;
  }

  return {
    contextText: parts.join(""),
    includedIndices,
    totalTokens,
    wasTruncated,
  };
}

/**
 * Configuration presets for common model context windows.
 */
export const ModelContextPresets = {
  /** Small models (e.g., GPT-3.5-turbo) - 4k context */
  small: {
    maxContextTokens: 1024, // Conservative for retrieval context only
  },
  /** Medium models (e.g., GPT-4) - 8k context */
  medium: {
    maxContextTokens: 2048,
  },
  /** Large models (e.g., GPT-4-32k) - 32k context */
  large: {
    maxContextTokens: 4096,
  },
} as const;
