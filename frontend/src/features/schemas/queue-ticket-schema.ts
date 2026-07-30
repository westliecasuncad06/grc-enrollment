import { z } from "zod"

const queueTicketStatusValues = [
  "waiting",
  "serving",
  "served",
  "cancelled",
] as const

export const queueTicketResourceSchema = z
  .object({
    type: z.literal("queue_ticket"),
    id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    student_number: z.string().min(1),
    ticket_number: z.string().min(1),
    queue_date: z.iso.date(),
    status: z.enum(queueTicketStatusValues),
    status_label: z.string().min(1),
    served_at: z.iso.datetime().nullable(),
  })
  .strict()

export const queueTicketEnvelopeSchema = z
  .object({ data: queueTicketResourceSchema })
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

export const paginatedQueueTicketsSchema = z
  .object({
    data: z.array(queueTicketResourceSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const queueTicketFiltersSchema = z
  .object({
    queue_date: z.iso.date().optional(),
    status: z.enum(queueTicketStatusValues).optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export const updateQueueTicketInputSchema = z
  .object({ action: z.enum(["serve", "complete"]) })
  .strict()

export type QueueTicket = z.infer<typeof queueTicketResourceSchema>
export type QueueTicketFilters = z.input<typeof queueTicketFiltersSchema>
export type UpdateQueueTicketInput = z.infer<
  typeof updateQueueTicketInputSchema
>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
