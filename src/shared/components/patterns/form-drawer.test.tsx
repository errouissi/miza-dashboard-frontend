import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormDrawer } from "./form-drawer";

/**
 * jsdom does not lay out or scroll real pixels, so these assert the
 * structural invariant that actually causes the scroll fix to hold in a
 * real browser: the Save/Cancel footer is a DOM sibling of the field
 * region, never a descendant of it. If a future change nested the footer
 * back inside the scrollable container (or inside `children` itself), it
 * would scroll away with a long field list exactly like the original bug —
 * this test fails the moment that containment relationship changes, without
 * asserting on any Tailwind class name or computed style.
 */
describe("FormDrawer", () => {
  it("keeps the footer outside the field region's DOM subtree regardless of field-list length", () => {
    render(
      <FormDrawer open onOpenChange={vi.fn()} title="Edit thing" onSubmit={vi.fn()}>
        {Array.from({ length: 40 }, (_, i) => (
          <input key={i} aria-label={`field-${i}`} />
        ))}
      </FormDrawer>,
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const saveButton = screen.getByRole("button", { name: "Save" });
    const lastField = screen.getByLabelText("field-39");

    const fieldRegion = lastField.parentElement;
    expect(fieldRegion).not.toBeNull();
    expect(fieldRegion?.contains(cancelButton)).toBe(false);
    expect(fieldRegion?.contains(saveButton)).toBe(false);

    // Reachable and interactive no matter how long the field list is.
    expect(cancelButton).toBeEnabled();
    expect(saveButton).toBeEnabled();
  });

  it("still renders a single Save/Cancel footer for a short form, and Cancel still closes", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDrawer open onOpenChange={onOpenChange} title="Edit thing" onSubmit={vi.fn()}>
        <input aria-label="only-field" />
      </FormDrawer>,
    );

    screen.getByRole("button", { name: "Cancel" }).click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submitDisabled defaults to false — omitting it preserves existing behavior (Submit enabled, not pending)", () => {
    render(
      <FormDrawer open onOpenChange={vi.fn()} title="Edit thing" onSubmit={vi.fn()}>
        <input aria-label="only-field" />
      </FormDrawer>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("submitDisabled=true disables Submit even while not pending, and leaves Cancel enabled", () => {
    render(
      <FormDrawer
        open
        onOpenChange={vi.fn()}
        title="Edit thing"
        onSubmit={vi.fn()}
        submitDisabled
      >
        <input aria-label="only-field" />
      </FormDrawer>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("submitDisabled=false with isPending=true still disables Submit — the two reasons OR together", () => {
    render(
      <FormDrawer
        open
        onOpenChange={vi.fn()}
        title="Edit thing"
        onSubmit={vi.fn()}
        isPending
        submitDisabled={false}
      >
        <input aria-label="only-field" />
      </FormDrawer>,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
