import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";

/**
 * Route error boundary (FTA §11, Design System §23).
 *
 * Mounted on a PATHLESS layout route inside the shell, so a crashed page renders
 * here — inside the Outlet — while the sidebar and header stay usable. An operator
 * whose page broke must still be able to navigate away; a boundary that takes the
 * whole shell down turns one broken page into a dead application.
 *
 * Boundaries catch RENDER crashes. They are the last resort, not the error-handling
 * strategy: query failures are inline errors in their own region (Design System §23),
 * and a boundary firing in normal operation is a bug to fix, not a state to design
 * around.
 *
 * Raw backend messages and stack traces never render — a UX rule and a security
 * rule at once (FTA §17). What the operator gets is a support reference.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  // A thrown Response (404 from a loader, etc.). Loaders are unused (FTA D-4),
  // but react-router can still surface one, so it is handled rather than assumed away.
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={error.status === 404 ? "Page introuvable" : "Une erreur est survenue"}
        detail={error.status === 404 ? undefined : `HTTP ${error.status}`}
      />
    );
  }

  // A normalized AppError that escaped as far as a render crash.
  if (isAppError(error)) {
    const display = resolveErrorDisplay(error);

    return (
      <ErrorState
        title="Une erreur est survenue"
        // Registered copy when the code is known; otherwise the code itself, which
        // keeps an unknown failure diagnosable instead of opaque (FTA D-10).
        detail={display.message ?? display.code}
        reference={display.requestId}
      />
    );
  }

  return <ErrorState title="Une erreur est survenue" />;
}

/**
 * The calm 403 (Design System §23, FTA §11).
 *
 * IT IS NOT A REDIRECT TO LOGIN, and that distinction is the whole point: a 403
 * means "we know exactly who you are, and you may not do this". Treating it as
 * expiry would log an operator out of a working session for clicking one thing
 * they lacked a permission for. The session continues, untouched.
 *
 * Rendered inside the shell, so the sidebar stays usable and there is a way out.
 */
export function Forbidden() {
  return (
    <ErrorState
      title="Accès refusé"
      detail="Vous n'avez pas la permission d'accéder à cette page."
      action={
        <Link to="/" className="text-primary text-sm underline underline-offset-4">
          Retour à l'accueil
        </Link>
      }
    />
  );
}

/** The in-shell 404 — never a bare error page, always a path back (Design System §23). */
export function NotFound() {
  return (
    <ErrorState
      title="Page introuvable"
      detail="Cette adresse n'existe pas."
      action={
        <Link to="/" className="text-primary text-sm underline underline-offset-4">
          Retour à l'accueil
        </Link>
      }
    />
  );
}

type ErrorStateProps = {
  title: string;
  detail?: string;
  /** The correlation id, shown as an opaque support reference (FTA §11). */
  reference?: string;
  action?: React.ReactNode;
};

function ErrorState({ title, detail, reference, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-24 text-center"
    >
      <h1 className="text-xl font-semibold">{title}</h1>
      {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
      {reference ? (
        <p className="text-muted-foreground font-mono text-xs">Réf. {reference}</p>
      ) : null}
      {action}
    </div>
  );
}
