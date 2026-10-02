import { z } from "zod"

import { userRoles } from "@/features/auth/roles"

/**
 * Mirrors backend UserResource exactly. `.strict()` means an undeclared field
 * appearing in a response is treated as a contract violation rather than
 * silently ignored.
 */
export const actingContextSchema = z
  .object({
    role: z.enum(userRoles),
    college: z
      .enum(["ccs", "coe", "coa", "cbae"])
      .nullable()
      .optional(),
  })
  .strict()

export const userSchema = z
  .object({
    type: z.literal("user"),
    id: z.number().int().positive(),
    name: z.string().min(1),
    email: z.string().min(1),
    role: z.enum(userRoles),
    role_label: z.string().min(1),
    college: z
      .enum(["ccs", "coe", "coa", "cbae"])
      .nullable()
      .optional(),
    status: z.string().min(1),
    acting_context: actingContextSchema.nullable().optional(),
  })
  .strict()

/** Mirrors backend AuthResource exactly — a completed sign-in either way,
 * whether reached directly (no OTP required) or via the OTP verify step. */
const authSessionDataSchema = z
  .object({
    type: z.literal("auth-session"),
    token: z.string().min(1),
    token_type: z.literal("Bearer"),
    expires_at: z.string().min(1).nullable(),
    user: userSchema,
  })
  .strict()

/** Mirrors backend LoginOtpChallengeResource exactly — no token exists yet. */
const loginOtpChallengeDataSchema = z
  .object({
    type: z.literal("login-otp-challenge"),
    otp_required: z.literal(true),
    challenge_token: z.string().min(1),
    email: z.string().min(1),
    expires_at: z.string().min(1),
  })
  .strict()

export const authEnvelopeSchema = z
  .object({
    data: authSessionDataSchema,
  })
  .strict()

/**
 * `POST /auth/login` returns one of these two shapes depending on whether
 * `LoginOtpPolicy` required a fresh challenge for this account.
 */
export const loginResponseEnvelopeSchema = z
  .object({
    data: z.discriminatedUnion("type", [
      authSessionDataSchema,
      loginOtpChallengeDataSchema,
    ]),
  })
  .strict()

export const loginOtpChallengeEnvelopeSchema = z
  .object({
    data: loginOtpChallengeDataSchema,
  })
  .strict()

export const userEnvelopeSchema = z
  .object({
    data: userSchema,
  })
  .strict()

export type AuthenticatedUser = z.infer<typeof userSchema>
