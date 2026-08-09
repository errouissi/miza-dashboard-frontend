import { useState, type FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileUploadField, type FileUploadFieldProps } from "./file-upload-field";

/**
 * `existingUrl` (M7 Phase 1.5) is covered here directly, in isolation —
 * every prior FileUploadField behavior (the onboarding wizard's ~11
 * create-only callers) has no equivalent standalone test file and is
 * exercised through the wizard's own step tests instead; this file is
 * additive, matching the prop it verifies.
 */

function Harness(
  props: Partial<Omit<FileUploadFieldProps, "value" | "onChange">> & {
    onReport?: (file: File | null) => void;
  } = {},
) {
  const { onReport, ...rest } = props;
  const [value, setValue] = useState<File | null>(null);
  return (
    <FileUploadField
      label="Photo"
      required={false}
      accept="image/jpeg,image/png"
      value={value}
      onChange={(file) => {
        setValue(file);
        onReport?.(file);
      }}
      {...rest}
    />
  );
}

function pngFile(name = "new-photo.png") {
  return new File(["binary"], name, { type: "image/png" });
}

describe("FileUploadField — unchanged create-only behavior (no existingUrl)", () => {
  it("shows 'No file chosen' when nothing is selected and nothing exists", () => {
    render(<Harness />);
    expect(screen.getByText("No file chosen")).toBeInTheDocument();
  });

  it("shows the selected file's name after choosing one", () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });

    expect(screen.getByText("new-photo.png")).toBeInTheDocument();
  });

  it("clears back to 'No file chosen' on Remove", () => {
    render(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("No file chosen")).toBeInTheDocument();
  });
});

describe("FileUploadField — existingUrl (M7 Phase 1.5)", () => {
  it("shows the existing image preview when no replacement is selected", () => {
    render(<Harness existingUrl="https://example.test/agents/5/photo.jpg" />);

    expect(screen.getByText("Current file on record")).toBeInTheDocument();
    const img = screen.getByAltText("Photo — current file") as HTMLImageElement;
    expect(img.src).toBe("https://example.test/agents/5/photo.jpg");
  });

  it("shows a document link, not an <img>, for a non-image existing URL", () => {
    render(<Harness existingUrl="https://example.test/agents/5/certificat.pdf" />);

    expect(screen.getByRole("link", { name: "View current file" })).toHaveAttribute(
      "href",
      "https://example.test/agents/5/certificat.pdf",
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("switches to the local replacement's preview once one is selected", () => {
    render(<Harness existingUrl="https://example.test/agents/5/photo.jpg" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });

    expect(screen.getByText("new-photo.png")).toBeInTheDocument();
    expect(screen.getByAltText("Photo preview")).toBeInTheDocument();
    // The existing-file preview is gone while a replacement is staged.
    expect(screen.queryByAltText("Photo — current file")).not.toBeInTheDocument();
  });

  it("reverting the replacement (Remove) restores the existing preview", () => {
    render(<Harness existingUrl="https://example.test/agents/5/photo.jpg" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("Current file on record")).toBeInTheDocument();
    expect(screen.getByAltText("Photo — current file")).toBeInTheDocument();
    expect(screen.queryByText("No file chosen")).not.toBeInTheDocument();
  });

  it("reports null via onChange on Remove — never a synthesized File from the URL", () => {
    const reports: (File | null)[] = [];
    render(
      <Harness
        existingUrl="https://example.test/agents/5/photo.jpg"
        onReport={(file) => reports.push(file)}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pngFile()] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(reports.at(-1)).toBeNull();
    expect(reports.every((file) => file === null || file instanceof File)).toBe(true);
  });
});

/**
 * Regression coverage for a real runtime bug found in manual QA (Agent
 * Edit, M7): replacing an existing Photo made the drawer's content jump to
 * an unexpected scroll position. Root cause, traced to actual installed
 * source (`@radix-ui/react-focus-scope`'s `FocusScope`, the primitive
 * behind every Radix `Dialog`/`Sheet`): while `trapped`, it installs a
 * `MutationObserver` on the dialog's whole subtree and, the instant it sees
 * `document.activeElement === document.body` (exactly what happens
 * transiently during the native OS file-picker round trip) together with
 * ANY removed node anywhere in that subtree, it forcibly refocuses the
 * dialog's container — yanking focus (and the scrolled-to position) away
 * from wherever the operator was, however unrelated that removed node was
 * to the file field itself.
 *
 * The previous implementation swapped between differently-shaped JSX
 * (`<span>` alone vs. a `<>` fragment with `<span>+<Button>`, and a three-way
 * `<img>`/`<a>`/`null` ternary) on every `value`/`existingUrl` transition —
 * each swap is a genuine DOM node removal, confirmed directly with this
 * same `MutationObserver` technique against the old code before the fix
 * (one `removedNodes` mutation per replacement, carrying exactly the old
 * "Current file on record" `<span>`). The fix keeps one `<span>`, one
 * `Button`, one `<img>` and one `<a>` mounted at all times, toggling text
 * and the `hidden` attribute instead of the element tree — an attribute
 * patch, never a removal.
 *
 * jsdom cannot simulate the real focus race or real layout/scroll, so this
 * cannot assert on the visual jump itself — it asserts on the actual
 * mechanism that fed it: zero DOM removals under the `MutationObserver`
 * Radix's own `FocusScope` uses.
 */
describe("FileUploadField — DOM stability across selection (regression)", () => {
  function watchForRemovals(container: HTMLElement) {
    const removals: MutationRecord[] = [];
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) if (m.removedNodes.length > 0) removals.push(m);
    });
    observer.observe(container, { childList: true, subtree: true });
    return {
      async flush() {
        await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
        for (const m of observer.takeRecords()) {
          if (m.removedNodes.length > 0) removals.push(m);
        }
      },
      removals,
      disconnect: () => observer.disconnect(),
    };
  }

  function pdfFile(name = "replacement.pdf") {
    return new File(["binary"], name, { type: "application/pdf" });
  }

  it("selecting a replacement for an existing image removes no DOM node", async () => {
    const { container } = render(
      <Harness existingUrl="https://example.test/agents/5/photo.jpg" />,
    );
    const watcher = watchForRemovals(container);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pngFile("new-photo.jpg")] } });
    await watcher.flush();

    expect(watcher.removals).toHaveLength(0);
    watcher.disconnect();
  });

  it("replacing a selection repeatedly (image, then PDF, then image again) removes nothing — must not progressively break", async () => {
    const { container } = render(
      <Harness existingUrl="https://example.test/agents/5/photo.jpg" />,
    );
    const watcher = watchForRemovals(container);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pngFile("first.png")] } });
    await watcher.flush();
    fireEvent.change(input, { target: { files: [pdfFile("second.pdf")] } });
    await watcher.flush();
    fireEvent.change(input, { target: { files: [pngFile("third.png")] } });
    await watcher.flush();

    expect(watcher.removals).toHaveLength(0);
    watcher.disconnect();
  });

  it("select, Remove, select again removes nothing across the full round trip", async () => {
    const { container } = render(<Harness />);
    const watcher = watchForRemovals(container);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pngFile("a.png")] } });
    await watcher.flush();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await watcher.flush();
    fireEvent.change(input, { target: { files: [pngFile("b.png")] } });
    await watcher.flush();

    expect(watcher.removals).toHaveLength(0);
    watcher.disconnect();
  });

  it("a hidden (non-applicable) preview element never carries a stray src — no pointless request", () => {
    // Non-image existingUrl: the <img> stays mounted (for stability) but
    // hidden, and must not be assigned a src it would otherwise try to load.
    render(<Harness existingUrl="https://example.test/agents/5/certificat.pdf" />);
    const hiddenImg = document.querySelector("img") as HTMLImageElement | null;
    expect(hiddenImg).not.toBeNull();
    expect(hiddenImg).toHaveAttribute("hidden");
    expect(hiddenImg).not.toHaveAttribute("src");
  });

  it("file input is a non-submit control: selecting a file does not submit an enclosing form", () => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness existingUrl="https://example.test/agents/5/photo.jpg" />
      </form>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [pngFile()] } });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
