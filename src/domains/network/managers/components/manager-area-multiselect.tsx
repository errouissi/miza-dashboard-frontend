import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Ville } from "@/domains/reference/villes";
import {
  parseVilleSousResponsabiliteAreas,
  serializeVilleSousResponsabiliteAreas,
} from "../model/manager";

/**
 * The "area of responsibility" multi-select — a manager may be responsible
 * for MULTIPLE cities (business rule clarification), so a single free-text
 * input can no longer represent the field honestly.
 *
 * THE BACKEND CONTRACT IS UNCHANGED. `value`/`onChange` are still exactly the
 * one `ville_sous_responsabilite` STRING the backend has always accepted —
 * see `parseVilleSousResponsabiliteAreas`/`serializeVilleSousResponsabiliteAreas`
 * in `model/manager.ts` for the verified-from-source reasoning and the
 * frontend-only `", "` encoding chosen because the backend has no convention
 * of its own. This component never sends an array anywhere; the caller's
 * `onChange` receives the same string type `form.register` used to.
 *
 * NO NEW SHARED ABSTRACTION. This is domain-local, composed from plain HTML —
 * native `<input type="checkbox">` (free keyboard support and ARIA semantics,
 * no custom widget needed for that part) plus a hand-rolled disclosure panel.
 * `shared/components/ui/dropdown-menu.tsx` (Radix, portal-based) was
 * considered and rejected: its content portals to `document.body`, outside
 * whatever `within(dialog)` a test scopes to, which would make every
 * assertion here fight the portal instead of testing the behaviour. A plain
 * `<div>` panel in normal DOM flow has no such problem and needs no more
 * accessibility work than labelling it correctly.
 *
 * REMOVABLE CHIPS RENDER OUTSIDE THE TRIGGER, not nested inside it — nesting a
 * `<button>` (a chip's remove control) inside another `<button>` (the
 * trigger) is invalid HTML and breaks click targeting. The trigger only ever
 * shows a placeholder or a count; the chips are their own row underneath,
 * always visible when non-empty, each with its own real, sibling `<button>`.
 *
 * A CURRENT VALUE ABSENT FROM VILLES gets its own checkbox row too, labelled
 * honestly once the options have actually resolved (never asserted "not in
 * the reference list" while still loading or disabled — the same rule the
 * single-select city fields use) — and stays selected until the operator
 * unchecks it. Nothing here silently drops a value the operator did not touch.
 */
export type ManagerAreaMultiSelectProps = {
  id: string;
  /** The raw backend string — e.g. `""`, `"Casablanca"`, `"Casablanca, Rabat"`. */
  value: string;
  /** Called with the new backend string on every check/uncheck/remove. */
  onChange: (nextValue: string) => void;
  villes: Ville[];
  /** True once the Villes options have actually resolved — gates the "not in the reference list" label. */
  villesResolved: boolean;
  "aria-invalid"?: boolean;
};

const TRIGGER_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function ManagerAreaMultiSelect({
  id,
  value,
  onChange,
  villes,
  villesResolved,
  "aria-invalid": ariaInvalid,
}: ManagerAreaMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAreas = parseVilleSousResponsabiliteAreas(value);

  // Click-outside and Escape both close the panel — no Radix Popover here
  // (see the module docblock), so this is the plain-DOM equivalent.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const setAreas = (areas: string[]) => {
    onChange(serializeVilleSousResponsabiliteAreas(areas));
  };

  const toggleArea = (area: string, checked: boolean) => {
    setAreas(
      checked ? [...selectedAreas, area] : selectedAreas.filter((a) => a !== area),
    );
  };

  const removeArea = (area: string) => {
    setAreas(selectedAreas.filter((a) => a !== area));
  };

  const knownNames = new Set(villes.map((ville) => ville.nomVille));
  // Only asserted absent once the options have actually resolved — while
  // loading or disabled (no access-dashboard), every currently-selected area
  // is shown plainly rather than wrongly claimed to be legacy.
  const legacyAreas = selectedAreas.filter((area) => !knownNames.has(area));

  const optionRows: { name: string; isLegacy: boolean }[] = [
    ...villes.map((ville) => ({ name: ville.nomVille, isLegacy: false })),
    ...legacyAreas.map((name) => ({ name, isLegacy: villesResolved })),
  ];

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5">
      <button
        type="button"
        id={id}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-invalid={ariaInvalid}
        onClick={() => setIsOpen((open) => !open)}
        className={TRIGGER_CLASS}
      >
        <span
          className={selectedAreas.length === 0 ? "text-muted-foreground" : undefined}
        >
          {selectedAreas.length === 0
            ? "Select cities"
            : `${selectedAreas.length} ${selectedAreas.length === 1 ? "city" : "cities"} selected`}
        </span>
        <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
      </button>

      {selectedAreas.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedAreas.map((area) => (
            <span
              key={area}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            >
              {area}
              <button
                type="button"
                aria-label={`Remove ${area}`}
                onClick={() => removeArea(area)}
                className="hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="bg-popover text-popover-foreground max-h-60 overflow-y-auto rounded-md border p-1 shadow-md">
          {optionRows.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              No cities available.
            </p>
          ) : (
            optionRows.map(({ name, isLegacy }) => (
              <label
                key={name}
                className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedAreas.includes(name)}
                  onChange={(event) => toggleArea(name, event.target.checked)}
                />
                {name}
                {isLegacy ? (
                  <span className="text-muted-foreground text-xs">
                    (not in the reference list)
                  </span>
                ) : null}
              </label>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
