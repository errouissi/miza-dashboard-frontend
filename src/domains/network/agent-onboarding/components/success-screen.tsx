import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { AGENT_ROLE_LABELS } from "../model/agent-onboarding";
import type { CreateAgentResult } from "../api/agent-onboarding-api";

/**
 * A DEDICATED success step, not a toast. `store()`'s response carries a
 * backend-generated account number and an 8-char random password
 * (`generatePassword()`) that is shown exactly ONCE — `Agent::$hidden`
 * excludes `password` from every later read, so there is no way to recover
 * it if this screen is skipped or the operator navigates away too fast. A
 * toast-and-navigate flow (the pattern every other create/edit form in this
 * product uses) would lose it.
 */
export type AgentOnboardingSuccessScreenProps = {
  result: CreateAgentResult;
  onCreateAnother: () => void;
};

export function AgentOnboardingSuccessScreen({
  result,
  onCreateAnother,
}: AgentOnboardingSuccessScreenProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Agent created</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {result.agent.prenom} {result.agent.nom} has been onboarded as a{" "}
          {AGENT_ROLE_LABELS[result.agent.role]}. Save these credentials now — the
          password is shown only once and cannot be retrieved later.
        </p>
      </div>

      <dl className="flex flex-col gap-4 rounded-md border p-4">
        <CredentialRow label="Account number" value={result.credentials.numDeCompte} />
        <CredentialRow label="Password" value={result.credentials.password} />
      </dl>

      <div>
        <Button onClick={onCreateAnother}>Onboard another agent</Button>
      </div>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // `navigator.clipboard` is absent in some test/embedded environments —
      // the value stays visible and selectable as plain text either way.
      await navigator.clipboard?.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard write refused or unavailable; nothing to recover from here.
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="flex items-center gap-2">
        <code className="bg-muted rounded px-2 py-1 text-sm select-all">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopy()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </dd>
    </div>
  );
}
