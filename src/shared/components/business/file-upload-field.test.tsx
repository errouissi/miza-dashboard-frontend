import { useState } from "react";
import { describe, expect, it } from "vitest";
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
