import type { UseFormRegister } from "react-hook-form";
import { Input } from "@/shared/components/ui/input";
import type { AgentOnboardingFormValues } from "../model/agent-onboarding";

/**
 * A LOCAL label+input+error row, used throughout the wizard's steps. Not
 * extracted into `shared/` — it is typed against this domain's own form
 * values and exists only to avoid repeating the same three elements ~20
 * times across five step components.
 */
export type TextFieldProps = {
  name: keyof AgentOnboardingFormValues;
  label: string;
  register: UseFormRegister<AgentOnboardingFormValues>;
  error?: string;
  helperText?: string;
};

export function TextField({ name, label, register, error, helperText }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <Input id={name} aria-invalid={!!error} {...register(name)} />
      {helperText && !error ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
