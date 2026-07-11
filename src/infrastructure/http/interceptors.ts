import type { AxiosInstance } from "axios";
import { getAccessToken, sessionManager } from "../auth";
import { normalizeError } from "../errors";
import { REQUEST_ID_HEADER, createRequestId, resolveRequestId } from "./correlation";

/**
 * The request/response pipeline (FTA §7, §11).
 *
 * Four responsibilities, and no more:
 *   1. Attach the bearer token.
 *   2. Attach a correlation ID (B-4 pending — see correlation.ts).
 *   3. Normalize EVERY failure into an AppError, by envelope (Decision 1).
 *   4. Handle 401 centrally: terminate the session, once (FTA §11).
 *
 * Step 4 is why this lives in one place. A 401 handled per call site is a 401
 * forgotten at most call sites — which is precisely the gap Discovery found:
 * "a 401 mid-session has no defined UX".
 */
export function installInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    config.headers.set(REQUEST_ID_HEADER, createRequestId());
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const failure = error as {
        config?: { headers?: Record<string, unknown> };
        response?: { headers?: Record<string, unknown> };
      };

      const requestId = resolveRequestId(
        failure.response?.headers,
        failure.config?.headers,
      );

      const appError = normalizeError(error, { requestId });

      // A 401 means the session is over — there is no refresh flow to fall back
      // on, by backend design, and the frontend MUST NOT invent one (Decision 3).
      // `terminate()` is idempotent, so the five concurrent 401s a dashboard page
      // produces collapse into a single teardown and a single redirect.
      if (appError.kind === "auth") {
        sessionManager.terminate();
      }

      return Promise.reject(appError);
    },
  );
}
