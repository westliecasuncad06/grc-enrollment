import { z } from "zod"

const moneySchema = z.string().regex(/^\d+\.\d{2}$/)

const studentAccountEntrySchema = z
  .object({
    enrollment_id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    academic_term_label: z.string().min(1),
    assessment_amount: moneySchema,
    confirmed_payment_amount: moneySchema,
    account_payment_amount: moneySchema,
    outstanding_balance: moneySchema,
    promissory_note_on_file: z.boolean(),
  })
  .strict()

export const studentAccountTransactionSchema = z
  .object({
    id: z.string().min(1),
    transaction_type: z.enum(["enrollment_payment", "account_payment"]),
    transaction_type_label: z.string().min(1),
    enrollment_id: z.number().int().positive().nullable().optional(),
    academic_term_label: z.string().min(1),
    amount: moneySchema,
    reference_number: z.string().min(1),
    cashier_name: z.string().min(1),
    promissory_note_on_file: z.boolean(),
    processed_at: z.string().min(1),
  })
  .passthrough()

export const studentAccountSchema = z
  .object({
    type: z.literal("student_account"),
    student_id: z.number().int().positive(),
    student_name: z.string().min(1),
    student_number: z.string().min(1),
    year_level: z.number().int().positive(),
    currency: z.literal("PHP"),
    total_assessed: moneySchema,
    total_paid: moneySchema,
    prior_balance: moneySchema,
    outstanding_balance: moneySchema,
    advance_payment_balance: moneySchema.default("0.00"),
    has_promissory_note_on_file: z.boolean(),
    entries: z.array(studentAccountEntrySchema),
    transactions: z.array(studentAccountTransactionSchema).default([]),
  })
  .strict()

export const studentAccountEnvelopeSchema = z
  .object({ data: studentAccountSchema })
  .strict()

export const recordStudentAccountPaymentInputSchema = z
  .object({
    amount: z.number().positive().max(99_999_999.99),
  })
  .strict()

export type StudentAccountTransaction = z.infer<
  typeof studentAccountTransactionSchema
>
export type StudentAccount = z.infer<typeof studentAccountSchema>
export type RecordStudentAccountPaymentInput = z.infer<
  typeof recordStudentAccountPaymentInputSchema
>
