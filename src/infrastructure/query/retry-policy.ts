import { isAppError } from "../errors";

/**
 * The retry policy (FTA §8, §11). It is asymmetric, on purpose.
 *
 * QUERIES RETRY. A GET is safe to repeat by definition, and the most common
 * failure in an office is a momentary blip that one retry hides completely.
 *
 * QUERIES NEVER RETRY 4xx. A 403 or a 404 is a fact, not a blip; retrying it three
 * times delays the truth by two seconds and triples the load.
 *
 * MUTATIONS NEVER RETRY. Not "rarely" — never. A retried deposit validation may
 * settle twice; a retried approve may approve twice. Whether the backend happens to
 * be idempotent on a given endpoint is not a property the frontend may assume about
 * an endpoint that moves money. Failures surface with an explicit, human-initiated
 * retry (Design System §23).
 */

const MAX_QUERY_ATTEMPTS = 2;
const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 3000;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_ATTEMPTS) return false;

  // Only transport-level failures are retryable: network and 5xx (AppError.isRetryable).
  if (isAppError(error)) return error.isRetryable;

  // Something threw that never went through normalization. Don't guess — don't retry.
  return false;
}

export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attemptIndex, MAX_DELAY_MS);
}

/** Mutations do not retry. This constant exists so the rule is greppable. */
export const MUTATION_RETRY = false as const;
