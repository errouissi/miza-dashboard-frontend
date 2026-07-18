import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAppError } from "@/infrastructure/errors";
import { Input } from "@/shared/components/ui/input";
import { FormDrawer } from "@/shared/components/patterns/form-drawer";
import {
  useCreateProductMutation,
  useUpdateProductMutation,
} from "../queries/products-queries";
import {
  MIN_VALUE,
  OPERATORS,
  isOperator,
  type Operator,
  type Product,
} from "../model/product";

/**
 * Create/edit drawer (Design System §18: a drawer is a TASK).
 *
 * VALUE IS A PLAIN INTEGER FIELD, NOT A MONEY INPUT, and that asymmetry is
 * deliberate. `value` is money-DENOMINATED (dirhams) but integer-CONSTRAINED
 * server-side (`required|integer|min:0`). A Money input accepts "12,50" and would
 * hand the operator a guaranteed 422; an integer field accepts exactly what the
 * API accepts. Display still goes through formatMoney, where the Design System's
 * money rule actually applies — see the list page.
 *
 * Copy is temporary English pending O-1, matching the Villes/Secteurs precedent.
 */
const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255, "Name is too long."),
  // A string, not z.enum: the select's placeholder option is "", which is not a
  // member of the enum. The refine both rejects the placeholder and pins the value
  // to the backend's `in:IAM,INWI,ORANGE` rule.
  operator: z.string().refine(isOperator, { message: "Operator is required." }),
  // Validated as a STRING FIRST, then coerced — deliberately, and this order is
  // load-bearing: `z.coerce.number()` turns "" into 0, so coercing first would let
  // an empty field submit a zero-value product instead of raising "required".
  // `int()` mirrors the backend's `integer` rule, refusing 12.5 here rather than
  // letting the server 422 it.
  value: z
    .string()
    .min(1, "Value is required.")
    .transform((raw) => Number(raw))
    .pipe(
      z
        .number()
        .int("Value must be a whole number.")
        .min(MIN_VALUE, "Value cannot be negative."),
    ),
});

/** What the fields hold (all strings) versus what validation yields (`value` a number). */
type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent = create. Present = edit that product. */
  product?: Product;
};

export function ProductFormSheet({ open, onOpenChange, product }: ProductFormSheetProps) {
  const isEdit = product !== undefined;

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", operator: "", value: "" },
  });

  const createMutation = useCreateProductMutation();
  const updateMutation = useUpdateProductMutation();
  const mutation = isEdit ? updateMutation : createMutation;

  // Re-seed on open, or editing one product straight after another shows the
  // previous row's values.
  useEffect(() => {
    if (open) {
      form.reset({
        name: product?.name ?? "",
        operator: product?.operator ?? "",
        // Held as a string throughout: the field is one, and the schema validates
        // string-then-coerces (see above).
        value: product === undefined ? "" : String(product.value),
      });
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const onSubmit = form.handleSubmit((values) => {
    // `values` is the VALIDATED output: `value` is already a number, and
    // `operator` has passed the isOperator refine.
    const input = {
      name: values.name,
      operator: values.operator as Operator,
      value: values.value,
    };
    const onSuccess = () => onOpenChange(false);

    if (isEdit) {
      updateMutation.mutate({ id: product.id, ...input }, { onSuccess });
    } else {
      createMutation.mutate(input, { onSuccess });
    }
  });

  // Uniqueness is COMPOSITE server-side (name per operator), but Laravel reports
  // it against `name` — so it lands on the name field even though the conflict
  // involves the operator.
  const error = mutation.error;
  const nameError = isAppError(error) ? error.fieldErrors?.name?.[0] : undefined;
  const operatorError = isAppError(error) ? error.fieldErrors?.operator?.[0] : undefined;
  const valueError = isAppError(error) ? error.fieldErrors?.value?.[0] : undefined;
  const generalError =
    isAppError(error) &&
    !nameError &&
    !operatorError &&
    !valueError &&
    error.kind !== "validation"
      ? "Something went wrong. Please try again."
      : undefined;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit product" : "New product"}
      description={
        isEdit
          ? "Update this product's details."
          : "Add a recharge card to the catalogue."
      }
      onSubmit={onSubmit}
      isPending={mutation.isPending}
      errorMessage={generalError}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          autoFocus
          aria-invalid={!!form.formState.errors.name || !!nameError}
          {...form.register("name")}
        />
        {form.formState.errors.name ? (
          <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
        ) : null}
        {nameError ? <p className="text-destructive text-xs">{nameError}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="operator" className="text-sm font-medium">
          Operator
        </label>
        <select
          id="operator"
          aria-invalid={!!form.formState.errors.operator || !!operatorError}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50"
          {...form.register("operator")}
        >
          <option value="">Select an operator…</option>
          {OPERATORS.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
        {form.formState.errors.operator ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.operator.message}
          </p>
        ) : null}
        {operatorError ? (
          <p className="text-destructive text-xs">{operatorError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="value" className="text-sm font-medium">
          Value (DH)
        </label>
        <Input
          id="value"
          type="number"
          inputMode="numeric"
          step={1}
          min={MIN_VALUE}
          aria-invalid={!!form.formState.errors.value || !!valueError}
          {...form.register("value")}
        />
        {form.formState.errors.value ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.value.message}
          </p>
        ) : null}
        {valueError ? <p className="text-destructive text-xs">{valueError}</p> : null}
      </div>
    </FormDrawer>
  );
}
