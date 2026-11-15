import { ArrowRight } from "lucide-react";
import { login } from "@/app/actions";
import { AuthLayout } from "@/components/layout/auth-layout";
import { SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { Eyebrow } from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";
import { loginErrorMessage } from "@/lib/validation/login";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout>
      <Eyebrow>Your personal workspace</Eyebrow>
      <h2 className="text-3xl font-bold tracking-tight text-ink">Welcome back.</h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        Sign in to manage your WhatsApp assistant.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-xs leading-6 text-danger"
        >
          {loginErrorMessage(error)}
        </p>
      )}
      <form action={login} className="mt-8 flex flex-col gap-5">
        <Field label="Email address">
          <Input
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="you@example.com"
          />
        </Field>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-sm font-semibold text-ink">
            Password
          </label>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            maxLength={1024}
            required
            placeholder="Your password"
          />
        </div>
        <SubmitButton pendingLabel="Signing in…" className="mt-2 w-full">
          Sign in <ArrowRight size={16} aria-hidden="true" />
        </SubmitButton>
      </form>
      <p className="mt-7 text-center text-xs leading-6 text-muted">
        Single-owner workspace · Administrator access only
      </p>
    </AuthLayout>
  );
}
