import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LineItemsEditor, type LineItem } from "./line-items-editor";

const products = [
  { id: 1, name: "IAM 10 DH" },
  { id: 2, name: "INWI 20 DH" },
];

function line(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: 1,
    productId: 1,
    productName: "IAM 10 DH",
    quantity: 5,
    unitCost: "10.00",
    notes: null,
    ...overrides,
  };
}

describe("rendering", () => {
  it("renders existing lines", () => {
    render(
      <LineItemsEditor
        lines={[line()]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByText("IAM 10 DH")).toBeInTheDocument();
    expect(table.getByText("5")).toBeInTheDocument();
    expect(table.getByText("10.00")).toBeInTheDocument();
    expect(table.getByText("—")).toBeInTheDocument(); // notes placeholder
  });

  it("readOnly hides the add form and every row action", () => {
    render(
      <LineItemsEditor
        lines={[line()]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
        readOnly
      />,
    );

    expect(screen.queryByLabelText("Add product")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add line" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("renders the error banner when present", () => {
    render(
      <LineItemsEditor
        lines={[]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
        error="This product is already on this stock return."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/already on this stock return/i);
  });
});

describe("adding a line", () => {
  it("calls onAdd with parsed values and clears the form", () => {
    const onAdd = vi.fn();
    render(
      <LineItemsEditor
        lines={[]}
        productOptions={products}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add product"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Add notes"), {
      target: { value: "restock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(onAdd).toHaveBeenCalledWith({
      productId: 2,
      quantity: 3,
      unitCost: "20",
      notes: "restock",
    });
    expect(screen.getByLabelText("Add product")).toHaveValue("");
    expect(screen.getByLabelText("Add quantity")).toHaveValue("");
  });

  it("does not call onAdd without a selected product", () => {
    const onAdd = vi.fn();
    render(
      <LineItemsEditor
        lines={[]}
        productOptions={products}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("does not call onAdd for a non-numeric quantity or unit cost", () => {
    const onAdd = vi.fn();
    render(
      <LineItemsEditor
        lines={[]}
        productOptions={products}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add product"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Add quantity"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Add unit cost"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows 'Adding…' and disables every control while pendingId is 'new'", () => {
    render(
      <LineItemsEditor
        lines={[]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId="new"
      />,
    );

    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    expect(screen.getByLabelText("Add product")).toBeDisabled();
  });
});

describe("editing a line", () => {
  it("enters edit mode, then calls onUpdate with parsed values", () => {
    const onUpdate = vi.fn();
    render(
      <LineItemsEditor
        lines={[line()]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Unit cost"), { target: { value: "12.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdate).toHaveBeenCalledWith(1, {
      quantity: 7,
      unitCost: "12.50",
      notes: "",
    });
  });

  it("Cancel exits edit mode without calling onUpdate", () => {
    const onUpdate = vi.fn();
    render(
      <LineItemsEditor
        lines={[line()]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        pendingId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument();
  });
});

describe("removing a line", () => {
  it("calls onRemove with the line id", () => {
    const onRemove = vi.fn();
    render(
      <LineItemsEditor
        lines={[line()]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={onRemove}
        pendingId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("shows 'Removing…' on the pending line and disables Edit/Remove for every other line", () => {
    render(
      <LineItemsEditor
        lines={[line({ id: 1 }), line({ id: 2, productName: "INWI 20 DH" })]}
        productOptions={products}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        pendingId={1}
      />,
    );

    expect(screen.getByRole("button", { name: "Removing…" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })[1]).toBeDisabled();
  });
});
