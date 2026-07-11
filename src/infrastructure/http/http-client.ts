import axios from "axios";
import { config } from "../config";
import { installInterceptors } from "./interceptors";

/**
 * The one and only axios instance (FTA §7). This is the single module in the
 * application permitted to import axios — enforced by lint since M0.
 *
 * Everything else calls a resource's api/ module, which calls this. That rule is
 * what makes swapping the transport, adding request signing, or adding tracing a
 * one-file change.
 */
export const httpClient = axios.create({
  baseURL: config.apiBaseUrl,

  /**
   * MUST stay false, and it is not a formality.
   *
   * The backend sets SANCTUM_STATEFUL_DOMAINS to the Vite dev origin and appends
   * StartSession/EncryptCookies to the API middleware. If credentials were sent,
   * Sanctum would silently switch this app to cookie/session auth — which would
   * change the CSRF posture that FTA §17 declares "not applicable" on the grounds
   * that bearer tokens are not ambient credentials.
   *
   * We authenticate with a bearer token. We send no cookies. Changing this line
   * changes the security model and requires an ADR.
   */
  withCredentials: false,

  headers: { Accept: "application/json" },
});

installInterceptors(httpClient);
