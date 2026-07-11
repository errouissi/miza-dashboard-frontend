import { loadConfig } from "./env";

export type { AppConfig, Environment } from "./env";
export { loadConfig } from "./env";

/**
 * The application's configuration, validated at module load.
 * Importing this module is what makes a missing required value fail fast (FTA §14).
 */
export const config = loadConfig(import.meta.env);
