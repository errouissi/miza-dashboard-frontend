import { z } from "zod";

/**
 * The single validated configuration entry point (FTA §14).
 *
 * Rules this file exists to enforce:
 *  - Environment values enter the app here and NOWHERE else. `import.meta.env`
 *    must not appear in any other module.
 *  - Missing/malformed required configuration fails fast at bootstrap, loudly,
 *    rather than surfacing later as mysterious network errors.
 *  - No secrets. Everything shipped to a browser is public; anything secret
 *    belongs behind a backend endpoint.
 *  - Components branch on a declared *capability* (`config.features.*`), never
 *    on the environment's name.
 */

const environmentSchema = z.enum(["development", "test", "staging", "production"]);
export type Environment = z.infer<typeof environmentSchema>;

const rawEnvSchema = z.object({
  MODE: environmentSchema,
  VITE_API_BASE_URL: z.url("VITE_API_BASE_URL must be an absolute URL"),
});

export type AppConfig = {
  /** Infrastructure-only. Do NOT branch on this in a component — use `features`. */
  environment: Environment;
  apiBaseUrl: string;
  features: {
    devtools: boolean;
    errorReporting: boolean;
    environmentBanner: boolean;
  };
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export function loadConfig(rawEnv: unknown): AppConfig {
  const parsed = rawEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid frontend configuration — the application cannot start.\n${issues}\n` +
        `See .env.example for the required values.`,
    );
  }

  const { MODE: environment, VITE_API_BASE_URL: apiBaseUrl } = parsed.data;

  // A test run must never be *capable* of reaching a real backend (FTA §14).
  if (environment === "test" && !LOCAL_HOSTNAMES.has(new URL(apiBaseUrl).hostname)) {
    throw new Error(
      `Test configuration must never point at a real backend (got "${apiBaseUrl}"). ` +
        `Tests run against MSW; point VITE_API_BASE_URL at localhost.`,
    );
  }

  return {
    environment,
    apiBaseUrl,
    features: {
      // Production defaults are conservative: diagnostics off, reporting on.
      devtools: environment === "development",
      errorReporting: environment === "staging" || environment === "production",
      // Staging mirrors production, and says so (Design System §20).
      environmentBanner: environment !== "production",
    },
  };
}
