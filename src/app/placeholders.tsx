/**
 * Temporary placeholders. Both are deleted by the milestone that replaces them —
 * they live in one file precisely so that deletion is trivial.
 *
 * They are NOT domain pages and they contain no business logic.
 */

/**
 * The /login route SLOT.
 *
 * The route must exist because RequireAuth redirects here — without it an
 * unauthenticated visitor would be redirected into a 404. The login PAGE (form,
 * credentials, session establishment) is the auth flow and is explicitly out of
 * M1-B's scope.
 *
 * There is deliberately NO development authentication bypass: a dev-only session
 * seed is an auth bypass, and it would outlive the convenience that justified it.
 * Authenticated flows are verified by seeding the session store in tests.
 */
export function LoginPlaceholder() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Miza Dashboard</h1>
      <p className="text-muted-foreground text-sm">
        Connexion — à implémenter (flux d'authentification).
      </p>
    </main>
  );
}

/**
 * The authenticated landing placeholder, rendered INSIDE the shell at `/`.
 *
 * `/` deliberately does not redirect to "the first permitted route": with an empty
 * nav that resolves to nothing, and a redirect whose target depends on permissions
 * is a moving landing page. Overview (Architecture §5) takes this slot when it lands.
 */
export function WelcomePlaceholder() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Miza Dashboard</h1>
      <p className="text-muted-foreground text-sm">
        Aucun module n'est encore disponible. Les domaines métier arriveront dans les
        prochains jalons.
      </p>
    </div>
  );
}
