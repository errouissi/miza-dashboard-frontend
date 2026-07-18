import { useLocation } from "react-router-dom";
import { LoginPage } from "@/domains/auth";
import { readReturnPath } from "./return-path";

/**
 * Reads and re-validates `next` for the login page (return-path.ts's job stays
 * in app/, since domains/ may not import app/router — FTA §4). Falls back to
 * the app root, never to the login route itself.
 */
export function LoginRoute() {
  const location = useLocation();
  const returnTo = readReturnPath(location.search) ?? "/";
  return <LoginPage returnTo={returnTo} />;
}
