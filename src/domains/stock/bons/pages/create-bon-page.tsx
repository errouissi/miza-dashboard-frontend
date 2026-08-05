import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { FileUploadField } from "@/shared/components/business/file-upload-field";
import { useSupplierOptionsQuery } from "@/domains/reference/suppliers";
import { useCompanyOptionsQuery } from "@/domains/reference/companies";
import { useCreateBonMutation } from "../queries/bons-queries";
import { bonDetailPath, BONS_PATH } from "../routes";
import {
  createBonSchema,
  defaultCreateBonValues,
  EVIDENCE_ACCEPT,
  type CreateBonFormValues,
} from "../model/create-bon";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Record Bon page (roadmap M5, Phase 5) — `POST /admin/bons`. HEADER
 * FIELDS ONLY — lines are added afterward, on the detail page, same
 * "draft -> add lines -> validate" sequencing every prior Stock create
 * form already established.
 *
 * MULTIPART, LIKE CHEQUES' OWN CREATE FORM: `evidence` is required, so
 * this is the first Stock `FormData` request body — reuses Money's own
 * established pattern (`CreateChequePage`'s own `Controller` + shared
 * `FileUploadField`), NOT the M3.6 wizard's.
 *
 * TWO PLAIN, INDEPENDENT SELECTS — Supplier and Company — NOT a cascading
 * picker, same reasoning Allocation's own create form already established:
 * there is no coupling between the two fields to guarantee.
 *
 * `receivedAt` MIRRORS THE BACKEND'S OWN FUTURE-DATE REFUSAL CLIENT-SIDE
 * (see `model/create-bon.ts`) — a real business rule, not a UI nicety.
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — on success, navigate straight
 * to the new bon's OWN DETAIL PAGE, the actual next step in the roadmap's
 * own "draft -> add lines -> validate" sequence.
 */
export function CreateBonPage() {
  const navigate = useNavigate();

  const suppliersQuery = useSupplierOptionsQuery();
  const companiesQuery = useCompanyOptionsQuery();

  const form = useForm<CreateBonFormValues>({
    resolver: zodResolver(createBonSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateBonValues,
  });

  const createMutation = useCreateBonMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => navigate(bonDetailPath(created.id)),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const bonNumberError = fieldError("bon_number");
  const supplierError = fieldError("supplier_id");
  const companyError = fieldError("company_id");
  const notesError = fieldError("notes");
  const receivedAtError = fieldError("received_at");
  const evidenceError = fieldError("evidence");

  const hasFieldError =
    !!bonNumberError ||
    !!supplierError ||
    !!companyError ||
    !!notesError ||
    !!receivedAtError ||
    !!evidenceError;

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to record a bon."
        : "Something went wrong recording this bon. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Record bon</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a draft. Add lines and validate on the next page.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bonNumber" className="text-sm font-medium">
          Bon number
        </label>
        <Input
          id="bonNumber"
          aria-invalid={!!form.formState.errors.bonNumber || !!bonNumberError}
          {...form.register("bonNumber")}
        />
        {form.formState.errors.bonNumber ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.bonNumber.message}
          </p>
        ) : null}
        {bonNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {bonNumberError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bonSupplier" className="text-sm font-medium">
          Supplier
        </label>
        <select
          id="bonSupplier"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.supplierId || !!supplierError}
          {...form.register("supplierId")}
        >
          <option value="">Select a supplier</option>
          {(suppliersQuery.data ?? []).map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        {form.formState.errors.supplierId ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.supplierId.message}
          </p>
        ) : null}
        {supplierError ? (
          <p role="alert" className="text-destructive text-xs">
            {supplierError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bonCompany" className="text-sm font-medium">
          Company
        </label>
        <select
          id="bonCompany"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.companyId || !!companyError}
          {...form.register("companyId")}
        >
          <option value="">Select a company</option>
          {(companiesQuery.data ?? []).map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {form.formState.errors.companyId ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.companyId.message}
          </p>
        ) : null}
        {companyError ? (
          <p role="alert" className="text-destructive text-xs">
            {companyError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="receivedAt" className="text-sm font-medium">
          Received date
        </label>
        <Input
          id="receivedAt"
          type="date"
          aria-invalid={!!form.formState.errors.receivedAt || !!receivedAtError}
          {...form.register("receivedAt")}
        />
        {form.formState.errors.receivedAt ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.receivedAt.message}
          </p>
        ) : null}
        {receivedAtError ? (
          <p role="alert" className="text-destructive text-xs">
            {receivedAtError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes
        </label>
        <Input
          id="notes"
          aria-invalid={!!form.formState.errors.notes || !!notesError}
          {...form.register("notes")}
        />
        {form.formState.errors.notes ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.notes.message}
          </p>
        ) : null}
        {notesError ? (
          <p role="alert" className="text-destructive text-xs">
            {notesError}
          </p>
        ) : null}
      </div>

      <Controller
        control={form.control}
        name="evidence"
        render={({ field }) => (
          <FileUploadField
            label="Evidence"
            required
            accept={EVIDENCE_ACCEPT}
            helperText="JPEG, PNG or PDF, up to 5MB."
            value={field.value}
            onChange={field.onChange}
            error={form.formState.errors.evidence?.message ?? evidenceError}
          />
        )}
      />

      {generalError ? (
        <p role="alert" className="text-destructive text-sm">
          {generalError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(BONS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Recording…" : "Record Bon"}
        </Button>
      </div>
    </form>
  );
}
