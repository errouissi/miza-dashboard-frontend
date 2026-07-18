import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { isAppError } from "@/infrastructure/errors";
import { useLoginMutation } from "../queries/mutations";

/**
 * Copy in this file is TEMPORARY English (M1-C decision 6). O-1 — interface
 * language — is unresolved (implementation-status.md); replacing this copy is a
 * one-file follow-up once product signs off, not a reason to block the flow.
 */
const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type FormValues = z.infer<typeof schema>;

type LoginFormProps = {
  /** Called once a session has been established. Navigation stays the page's job. */
  onSuccess: () => void;
};

/**
 * The credentials form (FTA §10). Submission disables while pending; errors are
 * read from AppError.kind, never from the raw backend message when a safer
 * generic exists — "auth" (bad credentials) and "permission" (blocked account)
 * are the two shapes /auth/login actually returns (AuthController::loginUser).
 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const loginMutation = useLoginMutation();

  const onSubmit = form.handleSubmit((values) => {
    loginMutation.mutate(values, { onSuccess });
  });

  const error = loginMutation.error;
  const errorMessage = isAppError(error)
    ? error.kind === "auth"
      ? "Invalid email or password."
      : error.kind === "permission"
        ? (error.message ?? "Your account has been blocked.")
        : "Something went wrong. Please try again."
    : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          aria-invalid={!!form.formState.errors.email}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
        {form.formState.errors.password ? (
          <p className="text-destructive text-xs">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
