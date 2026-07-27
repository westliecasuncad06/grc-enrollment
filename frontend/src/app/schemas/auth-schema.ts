import { z } from "zod"

import { demoRoles } from "@/app/auth/demo-auth-types"

/**
 * Mirrors backend UserResource exactly. `.strict()` means an undeclared field
 * appearing in a response is treated as a contract violation rather than
 * silently ignored.
 */
const userSchema = z
  .object({
    type: z.literal("user"),
    id: z.number().int().positive(),
    name: z.string().min(1),
    email: z.string().min(1),
    role: z.enum(demoRoles),
    role_label: z.string().min(1),
    status: z.string().min(1),
  })
  .strict()

/** Mirrors backend AuthResource exactly. */
export const authEnvelopeSchema = z
  .object({
    data: z
      .object({
        type: z.literal("auth-session"),
        token: z.string().min(1),
        token_type: z.literal("Bearer"),
        expires_at: z.string().min(1).nullable(),
        user: userSchema,
      })
      .strict(),
  })
  .strict()

export const userEnvelopeSchema = z
  .object({
    data: userSchema,
  })
  .strict()

export type AuthenticatedUser = z.infer<typeof userSchema>
