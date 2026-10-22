import type { ModelKey } from "@/lib/router/config";

/** The router's settings as the page shows them; never the keys. */
export interface RouterSettings {
  models: ModelKey[];
  threshold: number;
  emailOn: boolean;
  /** Whether a knowledge base with routing rules is set. */
  knowledge: boolean;
}
