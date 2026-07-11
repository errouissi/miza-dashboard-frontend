import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/infrastructure/query";

/**
 * Provides the QueryClient (FTA §8).
 *
 * The client is created once, in state, rather than at module scope: a module-level
 * client is shared across test cases and across StrictMode remounts, which leaks cache
 * between them and produces tests that pass alone and fail together.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
