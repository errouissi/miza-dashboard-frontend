import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCompanyOptionsQuery } from "@/domains/reference/companies";
import { useCreateAllocationMutation } from "../queries/allocations-queries";
import { allocationDetailPath, ALLOCATIONS_PATH } from "../routes";
import {
  createAllocationSchema,
  defaultCreateAllocationValues,
  type CreateAllocationFormValues,
} from "../model/create-allocation";

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * The Record Allocation page (roadmap M5, Phase 4) —
 * `POST /admin/allocations`. HEADER FIELDS ONLY — see
 * `model/create-allocation.ts`'s own docblock for why lines are added
 * afterward, on the detail page, not part of this submission.
 *
 * TWO PLAIN, INDEPENDENT SELECTS — Company and Manager — NOT a cascading
 * picker. Return's/Transfer's own create forms need a cascade because their
 * binding rule couples the two fields (`commercial.manager_id === manager_id`);
 * Allocation's own binding pair (`company_id` + `agent_id` role=manager) has
 * no such coupling (re-verified this phase, ADR-0021) — the two selects are
 * independent, and there is nothing for a cascade to guarantee.
 *
 * COMPANY OPTIONS COME FROM `useCompanyOptionsQuery` (`domains/reference/
 * companies`) — every option offered is already active server-side
 * (`GET /admin/companies` filters to `active=true`), so there is no
 * client-side re-check needed, same reasoning already applied elsewhere in
 * this codebase to a picker whose source is already scoped correctly.
 *
 * MANAGER OPTIONS COME FROM `useManagerOptionsQuery({ status: "active" })` —
 * NOT the plain, unfiltered call the list filter uses. `StoreAllocationRequest`
 * rejects an inactive manager (`exists:agents,id` where `status=active`), so
 * offering one here would be a control guaranteed to fail (ADR-0009's own
 * discipline: expose only backend-supported capabilities).
 *
 * NO TOAST LIBRARY EXISTS IN THIS CODEBASE — on success, navigate straight
 * to the new allocation's OWN DETAIL PAGE (not the list) — this is where
 * the operator adds lines next, the actual next step in the roadmap's own
 * "draft -> add lines -> validate" sequence.
 */
export function CreateAllocationPage() {
  const navigate = useNavigate();

  const companiesQuery = useCompanyOptionsQuery();
  const managersQuery = useManagerOptionsQuery({ status: "active" });

  const form = useForm<CreateAllocationFormValues>({
    resolver: zodResolver(createAllocationSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultCreateAllocationValues,
  });

  const createMutation = useCreateAllocationMutation();

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (created) => navigate(allocationDetailPath(created.id)),
    });
  });

  const mutationError = createMutation.error;
  const fieldError = (wireName: string): string | undefined =>
    isAppError(mutationError) ? mutationError.fieldErrors?.[wireName]?.[0] : undefined;

  const allocationNumberError = fieldError("allocation_number");
  const companyError = fieldError("company_id");
  const agentError = fieldError("agent_id");
  const notesError = fieldError("notes");

  const hasFieldError =
    !!allocationNumberError || !!companyError || !!agentError || !!notesError;

  const generalError =
    isAppError(mutationError) && !hasFieldError
      ? mutationError.kind === "permission"
        ? "You do not have permission to record an allocation."
        : "Something went wrong recording this allocation. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex max-w-xl flex-col gap-6 p-6"
    >
      <div>
        <h1 className="text-2xl font-bold">Record allocation</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Submits a draft. Add lines and validate on the next page.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="allocationNumber" className="text-sm font-medium">
          Allocation number
        </label>
        <Input
          id="allocationNumber"
          aria-invalid={
            !!form.formState.errors.allocationNumber || !!allocationNumberError
          }
          {...form.register("allocationNumber")}
        />
        {form.formState.errors.allocationNumber ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.allocationNumber.message}
          </p>
        ) : null}
        {allocationNumberError ? (
          <p role="alert" className="text-destructive text-xs">
            {allocationNumberError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="allocationCompany" className="text-sm font-medium">
          Company
        </label>
        <select
          id="allocationCompany"
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
        <label htmlFor="allocationAgent" className="text-sm font-medium">
          Manager
        </label>
        <select
          id="allocationAgent"
          className={SELECT_CLASS}
          aria-invalid={!!form.formState.errors.agentId || !!agentError}
          {...form.register("agentId")}
        >
          <option value="">Select a manager</option>
          {(managersQuery.data ?? []).map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.prenom} {manager.nom}
            </option>
          ))}
        </select>
        {form.formState.errors.agentId ? (
          <p role="alert" className="text-destructive text-xs">
            {form.formState.errors.agentId.message}
          </p>
        ) : null}
        {agentError ? (
          <p role="alert" className="text-destructive text-xs">
            {agentError}
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

      {generalError ? (
        <p role="alert" className="text-destructive text-sm">
          {generalError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(ALLOCATIONS_PATH)}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Recording…" : "Record Allocation"}
        </Button>
      </div>
    </form>
  );
}
