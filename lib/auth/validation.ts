/** Proofly Phase 11: all public auth inputs are validated at the server boundary. */
import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.")
  .max(320, "Enter an email address up to 320 characters.")
  .transform(value => value.toLowerCase());

const password = z
  .string()
  .min(12, "Use at least 12 characters for your password.")
  .max(128, "Use a password up to 128 characters.");

export const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
  next: z.string().optional(),
});

export const emailSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function validationErrors(error: z.ZodError) {
  return error.flatten().fieldErrors;
}
