import { config } from "@/infrastructure/config";

/**
 * M0 bootstrap root.
 *
 * Deliberately not a page and not a placeholder for any future domain. It exists
 * so the app builds and runs, and so a bad configuration surfaces immediately.
 * The real shell (AppShell: sidebar + header + routed outlet) arrives in M1 with
 * the walking skeleton.
 */
export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">Miza Dashboard</h1>
      <p className="text-muted-foreground text-sm">
        M0 bootstrap. No features implemented — the walking skeleton lands in M1.
      </p>
      <p className="text-muted-foreground font-mono text-xs">
        environment: {config.environment} · api: {config.apiBaseUrl}
      </p>
    </main>
  );
}
