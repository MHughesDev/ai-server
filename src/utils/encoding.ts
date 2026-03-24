/**
 * Charset validation and content negotiation utilities.
 * L2-06 Phase 7.2: Protocol & Encoding productionization.
 */

// ============================================================================
// Charset Validation
// ============================================================================

/** Supported charsets */
export type Charset = "utf-8" | "utf-16" | "iso-8859-1" | "ascii";

/** Default charset for the API */
export const DEFAULT_CHARSET: Charset = "utf-8";


/**
 * Parse Content-Type header and extract charset.
 */
export function parseContentType(contentType: string | undefined): {
  mimeType: string;
  charset: Charset | undefined;
} {
  if (!contentType) {
    return { mimeType: "application/octet-stream", charset: undefined };
  }

  const parts = contentType.split(";").map((p) => p.trim());
  const mimeType = parts[0].toLowerCase();

  let charset: Charset | undefined;
  for (const part of parts.slice(1)) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key.toLowerCase() === "charset" && value) {
      const normalized = value.toLowerCase().replace(/["']/g, "");
      if (isValidCharset(normalized)) {
        charset = normalized;
      }
    }
  }

  return { mimeType, charset };
}

/**
 * Check if a charset value is valid/supported.
 */
export function isValidCharset(charset: string): charset is Charset {
  const validCharsets: Charset[] = ["utf-8", "utf-16", "iso-8859-1", "ascii"];
  return validCharsets.includes(charset.toLowerCase() as Charset);
}

/**
 * Validate that text conforms to the specified charset.
 * Simplified validation - production may need more thorough checking.
 */
export function validateCharset(text: string, charset: Charset): boolean {
  if (charset === "utf-8") {
    try {
      // Node.js Buffer can validate UTF-8
      Buffer.from(text, "utf8").toString("utf8") === text;
      return true;
    } catch {
      return false;
    }
  }

  if (charset === "ascii") {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0x7f) return false;
    }
    return true;
  }

  if (charset === "iso-8859-1") {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0xff) return false;
    }
    return true;
  }

  // For other charsets, assume valid
  return true;
}

/**
 * Build a Content-Type header with charset.
 */
export function buildContentType(mimeType: string, charset: Charset = DEFAULT_CHARSET): string {
  return `${mimeType}; charset=${charset}`;
}

// ============================================================================
// Content Negotiation
// ============================================================================

export interface AcceptHeader {
  type: string;
  subtype: string;
  params: Record<string, string>;
  quality: number;
}

/**
 * Parse Accept header into sorted list of preferences.
 */
export function parseAcceptHeader(accept: string | undefined): AcceptHeader[] {
  if (!accept) return [];

  const items = accept.split(",").map((item) => {
    const parts = item.trim().split(";");
    const [type, subtype] = parts[0].trim().split("/");
    const params: Record<string, string> = {};
    let quality = 1;

    for (const part of parts.slice(1)) {
      const [key, value] = part.trim().split("=");
      if (key && value) {
        if (key.trim() === "q") {
          quality = parseFloat(value.trim()) || 1;
        } else {
          params[key.trim()] = value.trim().replace(/["']/g, "");
        }
      }
    }

    return { type: type || "*", subtype: subtype || "*", params, quality };
  });

  // Sort by quality descending
  return items.sort((a, b) => b.quality - a.quality);
}

/**
 * Check if a MIME type matches an Accept preference.
 */
export function matchesAcceptPreference(mimeType: string, preference: AcceptHeader): boolean {
  const [type, subtype] = mimeType.split("/");
  const typeMatch = preference.type === "*" || preference.type === type;
  const subtypeMatch = preference.subtype === "*" || preference.subtype === subtype;
  return typeMatch && subtypeMatch;
}

/**
 * Select best content type from available options based on Accept header.
 */
export function selectContentType(
  acceptHeader: string | undefined,
  available: string[],
  defaultType: string
): string {
  if (!acceptHeader || available.length === 0) return defaultType;

  const preferences = parseAcceptHeader(acceptHeader);
  if (preferences.length === 0) return defaultType;

  for (const pref of preferences) {
    for (const type of available) {
      if (matchesAcceptPreference(type, pref)) {
        return type;
      }
    }
  }

  // No match found, return default
  return defaultType;
}

/**
 * Check if client accepts a specific MIME type.
 */
export function acceptsType(acceptHeader: string | undefined, mimeType: string): boolean {
  if (!acceptHeader) return true;

  const preferences = parseAcceptHeader(acceptHeader);
  for (const pref of preferences) {
    if (matchesAcceptPreference(mimeType, pref)) {
      return pref.quality > 0;
    }
  }

  return false;
}

// ============================================================================
// Accept-Encoding Negotiation
// ============================================================================

export interface EncodingPreference {
  encoding: string;
  quality: number;
}

/**
 * Parse Accept-Encoding header.
 */
export function parseAcceptEncoding(acceptEncoding: string | undefined): EncodingPreference[] {
  if (!acceptEncoding) return [{ encoding: "identity", quality: 1 }];

  const encodings = acceptEncoding.split(",").map((item) => {
    const parts = item.trim().split(";");
    const encoding = parts[0].trim();
    let quality = 1;

    for (const part of parts.slice(1)) {
      const [key, value] = part.trim().split("=");
      if (key.trim() === "q") {
        quality = parseFloat(value.trim()) || 0;
      }
    }

    return { encoding, quality };
  });

  // Sort by quality descending, with identity as default if not present
  const sorted = encodings.sort((a, b) => b.quality - a.quality);

  // Add identity if not present
  if (!sorted.some((e) => e.encoding === "identity")) {
    sorted.push({ encoding: "identity", quality: 0.001 }); // Lowest priority
  }

  return sorted;
}

/**
 * Select best encoding from available options.
 */
export function selectEncoding(
  acceptEncoding: string | undefined,
  supported: string[]
): string {
  const preferences = parseAcceptEncoding(acceptEncoding);

  for (const pref of preferences) {
    if (pref.quality === 0) continue;

    // Check for wildcard
    if (pref.encoding === "*") {
      // Return first supported encoding that's not identity
      const nonIdentity = supported.find((e) => e !== "identity");
      if (nonIdentity) return nonIdentity;
    }

    if (supported.includes(pref.encoding)) {
      return pref.encoding;
    }
  }

  return "identity";
}

// ============================================================================
// Language Negotiation
// ============================================================================

export interface LanguagePreference {
  language: string;
  quality: number;
}

/**
 * Parse Accept-Language header.
 */
export function parseAcceptLanguage(acceptLanguage: string | undefined): LanguagePreference[] {
  if (!acceptLanguage) return [];

  return acceptLanguage
    .split(",")
    .map((item) => {
      const parts = item.trim().split(";");
      const language = parts[0].trim();
      let quality = 1;

      for (const part of parts.slice(1)) {
        const [key, value] = part.trim().split("=");
        if (key.trim() === "q") {
          quality = parseFloat(value.trim()) || 0;
        }
      }

      return { language, quality };
    })
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Select best language match.
 */
export function selectLanguage(
  acceptLanguage: string | undefined,
  available: string[],
  defaultLanguage: string
): string {
  if (!acceptLanguage || available.length === 0) return defaultLanguage;

  const preferences = parseAcceptLanguage(acceptLanguage);

  for (const pref of preferences) {
    if (pref.quality === 0) continue;

    // Exact match
    if (available.includes(pref.language)) {
      return pref.language;
    }

    // Wildcard
    if (pref.language === "*") {
      return available[0];
    }

    // Partial match (e.g., "en" matches "en-US")
    const partial = available.find((lang) => lang.startsWith(pref.language + "-"));
    if (partial) return partial;
  }

  return defaultLanguage;
}
