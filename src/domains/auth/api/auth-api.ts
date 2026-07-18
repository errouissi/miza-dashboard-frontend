import { httpClient } from "@/infrastructure/http";
import type { Session } from "@/infrastructure/auth";

/**
 * The admin dashboard's login/logout calls (FTA §7). The only place this domain
 * touches HTTP.
 *
 * `app: "admin"` is load-bearing, not decorative: the backend's AuthController
 * takes the cookie/session branch ONLY when `app === "dashboard"` exactly — no
 * token is returned in that case, and `sessionManager.start()` requires one.
 * Any other value, including "admin", takes the bearer-token branch this app is
 * built on. Never send "dashboard" here — see M1-C audit, decision 3.
 */
const APP = "admin";

type LoginResponse = {
  success: true;
  token: string;
  user: Session["user"];
};

export async function login(email: string, password: string): Promise<Session> {
  const { data } = await httpClient.post<LoginResponse>("/auth/login", {
    email,
    password,
    app: APP,
  });
  return { token: data.token, user: data.user };
}

/**
 * Revokes the token server-side. The caller (useLogoutMutation) terminates the
 * local session once this settles — success or failure — never before: a client-
 * only teardown ahead of the network call would leave a "logged out" UI sitting
 * on top of a still-valid bearer token.
 */
export async function logout(): Promise<void> {
  await httpClient.post("/auth/logout");
}
