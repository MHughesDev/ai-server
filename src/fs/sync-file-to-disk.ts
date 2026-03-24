/**
 * Best-effort flush of a file's data/metadata to disk (post-append).
 * Used when optional AUDIT_LOG_FSYNC / OBSERVABILITY_EVENT_SINK_FSYNC is enabled.
 */

import { open } from "node:fs/promises";

export async function syncFileToDisk(filePath: string): Promise<void> {
  const h = await open(filePath, "r");
  try {
    await h.sync();
  } finally {
    await h.close();
  }
}
