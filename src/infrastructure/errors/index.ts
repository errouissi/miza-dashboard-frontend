export { AppError, isAppError } from "./app-error";
export type { AppErrorInit, AppErrorKind, FieldErrors } from "./app-error";

export { normalizeError } from "./normalize-error";
export type { NormalizeContext } from "./normalize-error";

export { ERROR_CODES, lookupErrorCode, resolveErrorDisplay } from "./error-code-registry";
export type {
  ErrorCodeEntry,
  ErrorDisplay,
  ErrorTone,
  RecoveryPath,
} from "./error-code-registry";
