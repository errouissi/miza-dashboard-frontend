import { useState } from "react";
import { DataTable, type DataTableColumn } from "./data-table";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

/**
 * The line-item editor for a Stock draft (roadmap M5) — add / edit / remove
 * a product line while the parent document is a draft; a plain read-only
 * table once it is not.
 *
 * EXTRACTED NOW, AT THE FIRST CALLER (Agent Stock Returns), NOT DEFERRED TO
 * A THIRD — the same category of decision `useFreshConfirm` already made at
 * M4's G4 closure: the line CONTRACT (`product_id`, `quantity`, `unit_cost`,
 * `notes`) is verified IDENTICAL across all four Stock movement types' own
 * FormRequests (`StoreBonLineRequest`/`StoreAllocationLineRequest`/
 * `StoreAgentTransferLineRequest`/`StoreAgentStockReturnLineRequest`, read
 * fresh from source this phase) — contract-proven uniformity, not
 * reuse-count speculation. CLAUDE.md's Rule-of-Three governs abstractions
 * discovered by repetition; this one is mandated by an already-verified
 * shared shape.
 *
 * PRESENTATION ONLY — the same boundary `ConfirmActionDialog` holds: no
 * mutation, no query client, no domain type (`productId`/`unitCost` are
 * generic numeric/decimal-string fields, not Stock-specific business
 * knowledge). The caller owns every mutation, its pending state, and any
 * error copy — passed in as `onAdd`/`onUpdate`/`onRemove`, `pendingId`,
 * `error`.
 *
 * `unitCost` IS `string | null` ON THE ITEM TYPE, NOT `string` — Bon's own
 * line `unit_cost` is `nullable` (verified from `StoreBonLineRequest`),
 * unlike Allocation/AgentTransfer/AgentStockReturn's `required`. This
 * editor tolerates both; a caller for a `required` resource simply never
 * produces a `null` value. Rendered verbatim (a decimal-cast string on the
 * wire) — never parsed for display, only for the add/edit form's own
 * numeric validation, mirrored client-side from the backend's own
 * `numeric|min:0` rule.
 *
 * ONLY ONE ROW CAN BE "IN FLIGHT" AT A TIME (`pendingId`) — mirrors FTA
 * D-7 (no optimistic updates): the caller serializes one line mutation at a
 * time rather than allowing concurrent add/edit/remove requests whose
 * completion order would be ambiguous to reconcile locally.
 *
 * PRODUCT IS NOT EDITABLE ON AN EXISTING LINE — deliberately narrower than
 * the backend allows (`UpdateXLineRequest`'s `product_id` is `sometimes`,
 * genuinely editable). Changing a line's product while quantity/cost stay
 * requires re-deriving whether the OLD product's duplicate-check and the
 * NEW product's duplicate-check both still hold — a real edge case with no
 * named caller yet. Removing and re-adding a line covers the same outcome
 * today; this can be revisited if a real need for in-place product changes
 * appears.
 */
export type LineItem = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitCost: string | null;
  notes: string | null;
};

export type LineItemDraft = {
  productId: number;
  quantity: number;
  unitCost: string;
  notes: string;
};

export type LineItemUpdate = {
  quantity: number;
  unitCost: string;
  notes: string;
};

export type LineItemsEditorProduct = {
  id: number;
  name: string;
};

export type LineItemsEditorProps = {
  lines: LineItem[];
  productOptions: LineItemsEditorProduct[];
  onAdd: (values: LineItemDraft) => void;
  onUpdate: (lineId: number, values: LineItemUpdate) => void;
  onRemove: (lineId: number) => void;
  /** The line currently being mutated (`"new"` for an in-flight add), or `null` when idle. */
  pendingId: number | "new" | null;
  /** Domain-owned copy for the most recent failure, if any — rendered as a single banner. */
  error?: string;
  /** Once the parent is no longer a draft: a plain table, no inputs, no actions. */
  readOnly?: boolean;
};

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

function parseQuantity(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return value >= 1 ? value : null;
}

function parseUnitCost(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 ? value : null;
}

export function LineItemsEditor({
  lines,
  productOptions,
  onAdd,
  onUpdate,
  onRemove,
  pendingId,
  error,
  readOnly = false,
}: LineItemsEditorProps) {
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnitCost, setNewUnitCost] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const startEdit = (line: LineItem) => {
    setEditingLineId(line.id);
    setEditQuantity(String(line.quantity));
    setEditUnitCost(line.unitCost ?? "");
    setEditNotes(line.notes ?? "");
  };

  const cancelEdit = () => setEditingLineId(null);

  const saveEdit = (lineId: number) => {
    const quantity = parseQuantity(editQuantity);
    const unitCost = parseUnitCost(editUnitCost);
    if (quantity === null || unitCost === null) return;
    onUpdate(lineId, {
      quantity,
      unitCost: editUnitCost.trim(),
      notes: editNotes.trim(),
    });
    // Exits edit mode immediately rather than waiting for the mutation to
    // settle — the same "commit immediately, trust the round trip" choice
    // `submitAdd` below already makes for the add form. The caller's own
    // invalidate-and-refetch (FTA D-7 — no optimistic updates, but also no
    // reason to hold the row hostage to render its OWN pending state) will
    // correct the displayed row; a failure surfaces through the shared
    // `error` banner, and Edit can be reopened against whatever the server
    // now holds.
    setEditingLineId(null);
  };

  const submitAdd = () => {
    const productId = Number(newProductId);
    const quantity = parseQuantity(newQuantity);
    const unitCost = parseUnitCost(newUnitCost);
    if (!newProductId || quantity === null || unitCost === null) return;
    onAdd({
      productId,
      quantity,
      unitCost: newUnitCost.trim(),
      notes: newNotes.trim(),
    });
    setNewProductId("");
    setNewQuantity("");
    setNewUnitCost("");
    setNewNotes("");
  };

  const columns: DataTableColumn<LineItem>[] = [
    { key: "product", header: "Product", cell: (line) => line.productName },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      cell: (line) =>
        editingLineId === line.id ? (
          <Input
            aria-label="Quantity"
            inputMode="numeric"
            value={editQuantity}
            onChange={(event) => setEditQuantity(event.target.value)}
            disabled={pendingId === line.id}
            className="w-24"
          />
        ) : (
          line.quantity
        ),
    },
    {
      key: "unitCost",
      header: "Unit cost",
      align: "right",
      cell: (line) =>
        editingLineId === line.id ? (
          <Input
            aria-label="Unit cost"
            inputMode="decimal"
            value={editUnitCost}
            onChange={(event) => setEditUnitCost(event.target.value)}
            disabled={pendingId === line.id}
            className="w-24"
          />
        ) : (
          (line.unitCost ?? "—")
        ),
    },
    {
      key: "notes",
      header: "Notes",
      cell: (line) =>
        editingLineId === line.id ? (
          <Input
            aria-label="Notes"
            value={editNotes}
            onChange={(event) => setEditNotes(event.target.value)}
            disabled={pendingId === line.id}
          />
        ) : (
          (line.notes ?? "—")
        ),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (line) =>
        editingLineId === line.id ? (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => saveEdit(line.id)}
              disabled={pendingId === line.id}
            >
              {pendingId === line.id ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={pendingId === line.id}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startEdit(line)}
              disabled={pendingId !== null}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onRemove(line.id)}
              disabled={pendingId !== null}
            >
              {pendingId === line.id ? "Removing…" : "Remove"}
            </Button>
          </div>
        ),
    },
  ];

  const readOnlyColumns = columns.slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={readOnly ? readOnlyColumns : columns}
        rows={lines}
        rowKey={(line) => line.id}
      />

      {readOnly ? null : (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newLineProduct" className="text-sm font-medium">
              Add product
            </label>
            <select
              id="newLineProduct"
              className={SELECT_CLASS}
              value={newProductId}
              onChange={(event) => setNewProductId(event.target.value)}
              disabled={pendingId !== null}
            >
              <option value="">Select a product</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newLineQuantity" className="text-sm font-medium">
              Add quantity
            </label>
            <Input
              id="newLineQuantity"
              inputMode="numeric"
              className="w-24"
              value={newQuantity}
              onChange={(event) => setNewQuantity(event.target.value)}
              disabled={pendingId !== null}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newLineUnitCost" className="text-sm font-medium">
              Add unit cost
            </label>
            <Input
              id="newLineUnitCost"
              inputMode="decimal"
              className="w-24"
              value={newUnitCost}
              onChange={(event) => setNewUnitCost(event.target.value)}
              disabled={pendingId !== null}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newLineNotes" className="text-sm font-medium">
              Add notes
            </label>
            <Input
              id="newLineNotes"
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
              disabled={pendingId !== null}
            />
          </div>
          <Button type="button" onClick={submitAdd} disabled={pendingId !== null}>
            {pendingId === "new" ? "Adding…" : "Add line"}
          </Button>
        </div>
      )}
    </div>
  );
}
