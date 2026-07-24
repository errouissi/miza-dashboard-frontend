import { useFormContext } from "react-hook-form";
import type { AgentOnboardingFormValues } from "../../model/agent-onboarding";
import { TextField } from "../text-field";

/**
 * Step 3 — Financial. `salaire`, `montant_declaration_cnss` and
 * `charge_auto_entrepreneur` are validated as `integer` server-side — whole
 * numbers only, despite their decimal(10,2) columns — so they are plain
 * digit-only fields, not French-formatted money inputs.
 *
 * `montant_essence` ("Fuel amount") is NOT here — see `MotoStep`. Found
 * during M3.6's manual-validation review: the field only ever applies to a
 * GAS motorcycle (`AgentController::store` force-zeroes it for every other
 * combination), so it now lives on the step where that is actually known,
 * rather than being shown here unconditionally for a value the backend will
 * silently discard.
 *
 * The subscription number's LABEL reads "Phone Subscription Number" — a
 * wording fix only. The wire field name (`num_d_abonnement`, `numDAbonnement`
 * here) is unchanged.
 */
export function FinancialStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<AgentOnboardingFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <TextField
        name="numDAbonnement"
        label="Phone Subscription Number"
        register={register}
        error={errors.numDAbonnement?.message}
      />
      <TextField
        name="salaire"
        label="Salary (MAD, whole numbers)"
        register={register}
        error={errors.salaire?.message}
      />
      <TextField
        name="montantDeclarationCnss"
        label="CNSS declared amount (MAD, whole numbers)"
        register={register}
        error={errors.montantDeclarationCnss?.message}
      />
      <TextField
        name="chargeAutoEntrepreneur"
        label="Auto-entrepreneur charge (MAD, whole numbers)"
        register={register}
        error={errors.chargeAutoEntrepreneur?.message}
      />
    </div>
  );
}
