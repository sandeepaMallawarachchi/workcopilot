import { describe, expect, it } from "vitest";
import {
  loginErrorMessage,
  loginFailureCode,
  loginSchema,
} from "../src/lib/validation/login";

describe("login validation and safe feedback", () => {
  it("normalizes email without modifying password characters", () => {
    expect(
      loginSchema.parse({ email: "  Owner@Example.com ", password: " secret " }),
    ).toEqual({ email: "owner@example.com", password: " secret " });
  });
  it("accepts an existing six-character password at sign-in", () => {
    expect(
      loginSchema.safeParse({ email: "owner@example.com", password: "abc123" }).success,
    ).toBe(true);
  });
  it("rejects empty passwords and invalid email addresses", () => {
    expect(
      loginSchema.safeParse({ email: "owner@example.com", password: "" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: "admin@2026", password: "password" }).success,
    ).toBe(false);
  });
  it("distinguishes rejected credentials, confirmation, limits and service errors", () => {
    expect(loginFailureCode({ code: "invalid_credentials", status: 400 })).toBe("login");
    expect(loginFailureCode({ code: "email_not_confirmed", status: 400 })).toBe(
      "unconfirmed",
    );
    expect(loginFailureCode({ status: 429 })).toBe("rate_limited");
    expect(loginFailureCode({ status: 0 })).toBe("unavailable");
    expect(loginFailureCode({ status: 503 })).toBe("unavailable");
  });
  it("does not render arbitrary errors or query values", () => {
    expect(loginErrorMessage("arbitrary-secret-from-url")).toBe(
      loginErrorMessage("login"),
    );
    expect(loginErrorMessage("toString")).toBe(loginErrorMessage("login"));
  });
});
