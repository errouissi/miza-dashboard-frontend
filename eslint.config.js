import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Architecture boundaries — Frontend Technical Architecture §4 (import matrix).
 *
 *   app -> domains -> shared -> infrastructure     (downward only)
 *
 * Enforced with ESLint's core `no-restricted-imports` (no extra plugin).
 * Two conventions make that sufficient:
 *   1. Cross-boundary imports use the `@/` alias.
 *   2. Imports inside a resource stay relative (`./api`, `../model`), so they
 *      never contain `domains/` and are never caught by the deep-import ban.
 *
 * Each pattern is doubled (`@/x/**` and `**​/x/**`) so a relative path that
 * climbs out of its own layer is caught too.
 */
const layer = (name) => [`@/${name}/**`, `**/${name}/**`];

const DEEP_RESOURCE_IMPORT = {
  // Allowed:   @/domains/money/cheques          (a resource's public index)
  // Forbidden: @/domains/money/cheques/api/...  (reaching past the front door)
  group: [
    "@/domains/*/*/*",
    "@/domains/*/*/*/**",
    "**/domains/*/*/*",
    "**/domains/*/*/*/**",
  ],
  message:
    "FTA §4: import a resource only through its public index (@/domains/<domain>/<resource>). Reaching into its internals is forbidden.",
};

const AXIOS_ONLY_IN_HTTP = {
  name: "axios",
  message:
    "FTA §7: axios is used only inside src/infrastructure/http. Use the HTTP client / the resource's api/ module.",
};

export default defineConfig([
  globalIgnores(["dist", "coverage"]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // Baseline for all source: no deep resource imports, axios stays in one place.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_RESOURCE_IMPORT], paths: [AXIOS_ONLY_IN_HTTP] },
      ],
    },
  },

  // shared/ must never import from domains/ or app/.
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            DEEP_RESOURCE_IMPORT,
            {
              group: [...layer("domains"), ...layer("app")],
              message:
                "FTA §4: shared/ must not import from domains/ or app/. Pass the data in as props or config instead.",
            },
          ],
          paths: [AXIOS_ONLY_IN_HTTP],
        },
      ],
    },
  },

  // infrastructure/ must never import from shared/, domains/ or app/.
  {
    files: ["src/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            DEEP_RESOURCE_IMPORT,
            {
              group: [...layer("domains"), ...layer("shared"), ...layer("app")],
              message:
                "FTA §4: infrastructure/ knows nothing about Miza. It must not import from shared/, domains/ or app/.",
            },
          ],
          paths: [AXIOS_ONLY_IN_HTTP],
        },
      ],
    },
  },

  // ...except the HTTP client, which is the one module allowed to use axios.
  {
    files: ["src/infrastructure/http/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            DEEP_RESOURCE_IMPORT,
            {
              group: [...layer("domains"), ...layer("shared"), ...layer("app")],
              message:
                "FTA §4: infrastructure/ must not import from shared/, domains/ or app/.",
            },
          ],
        },
      ],
    },
  },

  // domains/ must never import from app/.
  {
    files: ["src/domains/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            DEEP_RESOURCE_IMPORT,
            {
              group: layer("app"),
              message:
                "FTA §4: domains/ must not import from app/. Dependencies point downward only.",
            },
          ],
          paths: [AXIOS_ONLY_IN_HTTP],
        },
      ],
    },
  },

  // Test harness may wire anything together.
  {
    files: ["src/test/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },

  /**
   * shadcn/ui primitives are GENERATED and vendored (FTA §12): they are
   * regenerated from upstream, never hand-edited, so upstream's stylistic
   * choices are not ours to lint. Architecture boundaries above still apply to
   * them — only authorship-style rules are relaxed.
   */
  {
    files: ["src/shared/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/purity": "off",
    },
  },
]);
