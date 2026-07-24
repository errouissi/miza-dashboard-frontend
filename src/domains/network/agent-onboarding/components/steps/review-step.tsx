import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { ABSENT } from "@/shared/formatters";
import {
  AGENT_ROLE_LABELS,
  MOTO_TYPES,
  MOTO_TYPE_LABELS,
  type AgentOnboardingFormValues,
  type MotoType,
} from "../../model/agent-onboarding";

function motoTypeLabel(value: string | null | undefined): string {
  return value && (MOTO_TYPES as readonly string[]).includes(value)
    ? MOTO_TYPE_LABELS[value as MotoType]
    : ABSENT;
}

/**
 * Step 5 — Review. Read-only, summarizing every entered value before the
 * single final submission (FTA D-9, Design System §13's "mandatory review
 * step"). Nothing here is editable; going back to a prior step is how a
 * value changes.
 */
export function ReviewStep() {
  const { watch } = useFormContext<AgentOnboardingFormValues>();
  const values = watch();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Review everything below before creating this agent. Submitting is final — go back
        to change anything.
      </p>

      <SummarySection title="Identity">
        <SummaryRow label="Role" value={AGENT_ROLE_LABELS[values.role]} />
        <SummaryRow label="Name" value={`${values.prenom} ${values.nom}`} />
        <SummaryRow label="City" value={values.ville} />
        <SummaryRow label="Address" value={values.adresse} />
        <SummaryRow label="CIN" value={values.numCin} />
        <SummaryRow label="ICE" value={values.numIce} />
        {values.role === "manager" ? (
          <SummaryRow
            label="Area of responsibility"
            value={values.villeSousResponsabilite || ABSENT}
          />
        ) : (
          <>
            <SummaryRow label="Current city" value={values.villeActuelle || ABSENT} />
            <SummaryRow label="Sector" value={values.secteur || ABSENT} />
          </>
        )}
      </SummarySection>

      <SummarySection title="Documents">
        <SummaryRow label="Photo" value={values.photo?.name ?? ABSENT} />
        <SummaryRow label="CIN — front" value={values.photoCinRecto?.name ?? ABSENT} />
        <SummaryRow label="CIN — back" value={values.photoCinVerso?.name ?? ABSENT} />
        <SummaryRow
          label="Habitat certificate"
          value={values.certificatDHabitat?.name ?? ABSENT}
        />
        <SummaryRow
          label="Auto-entrepreneur card"
          value={values.carteAutoEntrepreneur?.name ?? ABSENT}
        />
        <SummaryRow
          label="Anthropometric form"
          value={values.ficheAntroprometrique?.name ?? ABSENT}
        />
        <SummaryRow
          label="Bank incident form"
          value={values.ficheDIncidentBanquaire?.name ?? ABSENT}
        />
      </SummarySection>

      <SummarySection title="Financial">
        <SummaryRow label="Phone Subscription Number" value={values.numDAbonnement} />
        <SummaryRow label="Salary" value={values.salaire} />
        <SummaryRow label="CNSS declared amount" value={values.montantDeclarationCnss} />
        <SummaryRow
          label="Auto-entrepreneur charge"
          value={values.chargeAutoEntrepreneur}
        />
      </SummarySection>

      <SummarySection title="Motorcycle">
        {values.hasMoto ? (
          <>
            <SummaryRow label="Type" value={motoTypeLabel(values.typeMoto)} />
            {values.typeMoto === "essance" ? (
              <SummaryRow label="Fuel amount" value={values.montantEssence} />
            ) : null}
            <SummaryRow label="Chassis number" value={values.numDeChassis || ABSENT} />
            <SummaryRow
              label="Registration — front"
              value={values.cartGriseRecto?.name ?? ABSENT}
            />
            <SummaryRow
              label="Registration — back"
              value={values.cartGriseVerso?.name ?? ABSENT}
            />
            <SummaryRow label="Insurance" value={values.assurance?.name ?? ABSENT} />
            <SummaryRow
              label="Engagement letter"
              value={values.engagementMoto?.name ?? ABSENT}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No motorcycle.</p>
        )}
      </SummarySection>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {children}
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
