import { z } from "zod";

// Signing in must accept existing passwords independently of creation policy.
// Normalize only the email; spaces can be intentional password characters.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(1024),
});

export const loginErrors = {
  login:
    "Sign-in failed. Use the exact email registered in Supabase and its account password.",
  invalid_input: "Enter a valid email address and your password.",
  unconfirmed:
    "Confirm your email address before signing in, or ask your administrator to confirm the account in Supabase.",
  rate_limited: "Too many sign-in attempts. Wait a little before trying again.",
  unavailable:
    "Sign-in is temporarily unavailable. Check your connection and the Supabase project configuration, then try again.",
  unauthorized:
    "You’re signed in, but this account does not have an administrator profile. Ask the workspace owner to grant access.",
} as const;

export type LoginErrorCode = keyof typeof loginErrors;

export function loginFailureCode(error: {
  code?: string;
  status?: number;
}): LoginErrorCode {
  if (error.code === "invalid_credentials") return "login";
  if (error.code === "email_not_confirmed") return "unconfirmed";
  if (error.status === 429) return "rate_limited";
  return "unavailable";
}

export function loginErrorMessage(code: string): string {
  return Object.prototype.hasOwnProperty.call(loginErrors, code)
    ? loginErrors[code as LoginErrorCode]
    : loginErrors.login;
}
