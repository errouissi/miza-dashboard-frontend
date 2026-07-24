import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAppError } from "@/infrastructure/errors";
import { Button } from "@/shared/components/ui/button";
import { IdentityStep } from "../components/steps/identity-step";
import { DocumentsStep } from "../components/steps/documents-step";
import { FinancialStep } from "../components/steps/financial-step";
import { MotoStep } from "../components/steps/moto-step";
import { ReviewStep } from "../components/steps/review-step";
import { AgentOnboardingSuccessScreen } from "../components/success-screen";
import { useCreateAgentMutation } from "../queries/agent-onboarding-queries";
import type { CreateAgentResult } from "../api/agent-onboarding-api";
import {
  AGENT_ROLES,
  STEP_FIELDS,
  WIZARD_STEPS,
  agentOnboardingSchema,
  defaultAgentOnboardingValues,
  type AgentOnboardingFormValues,
  type AgentRole,
  type WizardStep,
} from "../model/agent-onboarding";

/**
 * The agent onboarding wizard (roadmap M3.6) — the product's only wizard
 * (FTA D-9), built as a single React Hook Form instance spanning all five
 * steps, not a state machine and not five separate per-step forms.
 *
 * BACK NAVIGATION PRESERVES DATA BY CONSTRUCTION: `stepIndex` only decides
 * which step's JSX renders; the `form` instance itself never unmounts and
 * every field's value lives in it regardless of which step is on screen.
 * There is no per-step reset anywhere in this file.
 *
 * "NEXT" VALIDATES ONLY THE CURRENT STEP (`form.trigger(STEP_FIELDS[step])`,
 * FTA D-9's "per-step schema") against the ONE full schema — the schema's
 * own `superRefine` only raises issues for whatever role/moto state is
 * currently selected, so a later step's untouched fields never block an
 * earlier one.
 *
 * THE SUBMISSION FLOW mirrors FTA §10 exactly: validate the whole form only
 * when the operator explicitly clicks Review's "Confirm and Create Agent"
 * (focus moves to the first invalid field — `shouldFocusError` is RHF's
 * default); suspend (the button disables and shows its pending label);
 * mutate, never optimistically, never auto-retried; on success, replace the
 * wizard with a dedicated success screen (not a toast — the generated
 * credentials must be SEEN); on failure, the form and its step are left
 * exactly as they were — nothing here ever calls `form.reset()` except
 * explicitly, after a NEW successful submission's "Onboard another agent"
 * action. This is what satisfies Design System §23's "a lost connection MUST
 * NOT cost a filled onboarding wizard its data" — by never having a code
 * path that would clear it, not by a separate persistence mechanism (see
 * ADR-0016-style discovery notes: this rule is about surviving a FAILED
 * SUBMISSION, not a browser reload — no draft-survives-a-refresh requirement
 * exists in the frozen documents).
 *
 * NO BUTTON IN THIS FORM IS EVER `type="submit"` — deliberately, after a
 * real bug found during manual validation. Moto→Review and the Review
 * confirm button previously occupied the SAME JSX tree position (one
 * ternary), so React reused the SAME underlying `<button>` DOM node across
 * the transition, only mutating its `type` attribute from `"button"` to
 * `"submit"` in place. Because that mutation happened synchronously inside
 * the very click handler that advanced `stepIndex`, the browser's native
 * "does this click submit the form" check — which runs AFTER synchronous
 * handlers, against the CURRENT (already-mutated) `type` attribute — saw
 * `"submit"` and fired an implicit form submission the instant Review
 * rendered, with no second click ever happening. Every button here is
 * `type="button"`; submission is wired directly to `handleConfirm`'s
 * `onClick`, never to the browser's native submit event. The `<form>`'s own
 * `onSubmit` is a no-op guard (`preventDefault` only) for the same reason —
 * an implicit Enter-key submission must not create an agent either.
 */

function readPreselectedRole(searchParams: URLSearchParams): AgentRole {
  const raw = searchParams.get("role");
  return (AGENT_ROLES as readonly string[]).includes(raw ?? "")
    ? (raw as AgentRole)
    : "manager";
}

const STEP_LABELS: Record<WizardStep, string> = {
  identity: "Identity",
  documents: "Documents",
  financial: "Financial",
  moto: "Motorcycle",
  review: "Review",
};

export function AgentOnboardingWizardPage() {
  const [searchParams] = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<CreateAgentResult | undefined>(undefined);

  const form = useForm<AgentOnboardingFormValues>({
    resolver: zodResolver(agentOnboardingSchema),
    // Design System §13: validate on blur first; re-validate on change once a
    // field has erred, so the error clears the instant it is fixed.
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: defaultAgentOnboardingValues(readPreselectedRole(searchParams)),
  });

  const createMutation = useCreateAgentMutation();
  const step = WIZARD_STEPS[stepIndex];

  const goNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step as Exclude<WizardStep, "review">]);
    if (valid) setStepIndex((index) => Math.min(index + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => setStepIndex((index) => Math.max(index - 1, 0));

  const submit = form.handleSubmit((values) => {
    createMutation.mutate(values, {
      onSuccess: (response) => setResult(response),
    });
  });

  // The ONLY path that ever calls `submit` (handleSubmit → FormData →
  // mutate). `createMutation.isPending` ALONE cannot guard against a
  // duplicate request from two clicks landing in the same synchronous
  // event-handling tick: `form.handleSubmit`'s validation is async, so
  // `mutate()` — and therefore `isPending` actually becoming true — does not
  // happen until a later microtask, well after a second `fireEvent.click`
  // (or a fast real double-click) has already re-read the STALE `isPending`
  // captured at the last render. `submittingRef` is a plain mutable value,
  // set synchronously before `submit()` is even called, so it is the one
  // thing a same-tick second click can actually observe as changed. It is
  // released once `submit()` settles (validation failure included, so an
  // invalid Review state — which should not occur by construction, every
  // prior step already validated — can never leave the button locked).
  const submittingRef = useRef(false);
  const handleConfirm = () => {
    if (submittingRef.current || createMutation.isPending) return;
    submittingRef.current = true;
    void submit().finally(() => {
      submittingRef.current = false;
    });
  };

  if (result) {
    return (
      <AgentOnboardingSuccessScreen
        result={result}
        onCreateAnother={() => {
          form.reset(defaultAgentOnboardingValues(result.agent.role));
          createMutation.reset();
          setStepIndex(0);
          setResult(undefined);
        }}
      />
    );
  }

  const mutationError = createMutation.error;
  const generalError =
    isAppError(mutationError) && mutationError.kind !== "validation"
      ? mutationError.kind === "permission"
        ? "You do not have permission to onboard agents."
        : "Something went wrong creating this agent. Please try again — nothing you entered has been lost."
      : undefined;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          // No-op guard only. No button here is ever `type="submit"`, so
          // this fires only from an implicit Enter-key submission — which
          // must not create an agent either. See the module docblock.
          event.preventDefault();
        }}
        noValidate
        className="mx-auto flex max-w-3xl flex-col gap-6 p-6"
      >
        <div>
          <h1 className="text-2xl font-bold">Onboard an agent</h1>
          <ol
            className="text-muted-foreground mt-2 flex flex-wrap gap-x-1 text-sm"
            aria-label="Steps"
          >
            {WIZARD_STEPS.map((wizardStep, index) => (
              <li
                key={wizardStep}
                aria-current={index === stepIndex ? "step" : undefined}
                className={
                  index === stepIndex ? "text-foreground font-medium" : undefined
                }
              >
                {index > 0 ? (
                  <span className="mr-1" aria-hidden="true">
                    →
                  </span>
                ) : null}
                {STEP_LABELS[wizardStep]}
              </li>
            ))}
          </ol>
        </div>

        {step === "identity" ? <IdentityStep /> : null}
        {step === "documents" ? <DocumentsStep /> : null}
        {step === "financial" ? <FinancialStep /> : null}
        {step === "moto" ? <MotoStep /> : null}
        {step === "review" ? <ReviewStep /> : null}

        {generalError ? (
          <p role="alert" className="text-destructive text-sm">
            {generalError}
          </p>
        ) : null}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0 || createMutation.isPending}
          >
            Back
          </Button>
          {step === "review" ? (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Confirm and Create Agent"}
            </Button>
          ) : (
            <Button type="button" onClick={() => void goNext()}>
              Next
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
