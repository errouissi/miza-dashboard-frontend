/**
 * Temporary placeholder. Deleted by the milestone that replaces it — it lives in
 * its own file precisely so that deletion is trivial.
 *
 * It is NOT a domain page and it contains no business logic.
 */

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
