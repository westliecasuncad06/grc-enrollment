import { z } from "zod"

const optionalUtcDateTimeSchema = z.iso.datetime().nullable()

export const notificationSchema = z
  .object({
    type: z.literal("notification"),
    id: z.number().int().positive(),
    notification_type: z.literal("schedule_published"),
    message: z.string().min(1),
    read_at: optionalUtcDateTimeSchema,
    created_at: optionalUtcDateTimeSchema,
  })
  .strict()

const paginationLinksSchema = z
  .object({
    first: z.string().url(),
    last: z.string().url(),
    prev: z.string().url().nullable(),
    next: z.string().url().nullable(),
  })
  .strict()

const paginationMetaSchema = z
  .object({
    current_page: z.number().int().positive(),
    last_page: z.number().int().positive(),
    per_page: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  })
  .passthrough()

export const notificationEnvelopeSchema = z
  .object({
    data: z.array(notificationSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const notificationResponseSchema = z
  .object({ data: notificationSchema })
  .strict()

export type Notification = z.infer<typeof notificationSchema>
export type NotificationEnvelope = z.infer<typeof notificationEnvelopeSchema>
