import { useMutation } from "@tanstack/react-query";
import { sessionManager, type Session } from "@/infrastructure/auth";
import { login, logout } from "../api/auth-api";

type LoginVariables = {
  email: string;
  password: string;
};

/**
 * Establishes a session on success. Never retries (MUTATION_RETRY, FTA §11) —
 * a login failure is a fact (bad credentials, blocked account), not a blip.
 */
export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ email, password }: LoginVariables) => login(email, password),
    onSuccess: (session: Session) => sessionManager.start(session),
  });
}

/**
 * Revokes the token, then terminates the local session once the call settles —
 * success or failure alike, per the approved M1-C logout sequencing.
 *
 * Deliberately performs NO navigation. `sessionManager.terminate()` is what
 * `wireSessionTermination` (app/bootstrap/wire-session.ts) reacts to, and that
 * handler is the application's single navigation authority for session end —
 * the same path a 401 already uses. A second navigate() call here would race it.
 */
export function useLogoutMutation() {
  return useMutation({
    mutationFn: logout,
    onSettled: () => sessionManager.terminate(),
  });
}
