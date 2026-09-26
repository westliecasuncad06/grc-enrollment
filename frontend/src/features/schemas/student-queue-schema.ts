import { z } from "zod"

const studentQueueStageValues = [
  "no_active_enrollment",
  "pending_program_head_approval",
  "pending_registrar_approval",
  "pending_payment",
  "enrolled",
] as const

const queueTicketStatusValues = [
  "waiting",
  "serving",
  "served",
  "cancelled",
] as const

const queueTicketPriorityValues = ["regular", "priority"] as const

export const studentQueueTicketSchema = z
  .object({
    ticket_number: z.string().min(1),
    status: z.enum(queueTicketStatusValues),
    status_label: z.string().min(1),
    priority: z.enum(queueTicketPriorityValues),
    priority_label: z.string().min(1),
    position: z.number().int().nonnegative().nullable(),
    // How many times the Cashier called this ticket out while it was serving.
    // Defaults to 0 so a response from a server that predates the counter
    // still parses.
    announce_count: z.number().int().nonnegative().default(0),
  })
  .strict()

export const studentQueueViewSchema = z
  .object({
    type: z.literal("student_queue_view"),
    stage: z.enum(studentQueueStageValues),
    can_claim: z.boolean(),
    ticket: studentQueueTicketSchema.nullable(),
    now_serving_ticket_number: z.string().min(1).nullable(),
    upcoming_ticket_numbers: z.array(z.string().min(1)),
    cut_off_today: z.boolean(),
  })
  .strict()

export const studentQueueViewEnvelopeSchema = z
  .object({ data: studentQueueViewSchema })
  .strict()

export type StudentQueueView = z.infer<typeof studentQueueViewSchema>
