import { z } from "zod";

/**
 * Auth validation schemas.
 *
 * Messages carry i18n keys (relative to the `validation` namespace) — the form
 * resolver translates them, keeping the schemas locale-agnostic and testable.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .email({ message: "validation.invalidEmail" }),
  password: z.string().min(1, { message: "validation.required" }),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .email({ message: "validation.invalidEmail" }),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(6, { message: "validation.passwordTooShortCount" }),
    confirmPassword: z.string().min(1, { message: "validation.required" }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
