import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

export const loginSchema = z.object({ email, password });

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be 80 characters or fewer."),
  email,
  password,
});

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
