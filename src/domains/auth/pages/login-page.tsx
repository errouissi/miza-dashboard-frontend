import { Navigate, useNavigate } from "react-router-dom";
import { useIsAuthenticated } from "@/shared/hooks";
import { LoginForm } from "../components/login-form";

type LoginPageProps = {
  /** Where to land after a successful login — the safe, re-validated `next`
   * param, or the app root. Computed by the router assembler (app/router/
   * routes.tsx), not read here: domains/ may not import app/router (FTA §4). */
  returnTo: string;
};

export function LoginPage({ returnTo }: LoginPageProps) {
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  // Reaching /login with a live session (typed URL, back button after login)
  // — send the operator on rather than showing a form they don't need.
  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <LoginForm onSuccess={() => navigate(returnTo, { replace: true })} />
    </main>
  );
}
