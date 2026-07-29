import { z } from "zod"

import { userRoles } from "@/features/auth/roles"

const nullableObject = z.record(z.string(), z.unknown()).nullable()

export const auditActions = [
  "curriculum.created",
  "curriculum.updated",
  "faculty_availability.created",
  "faculty_availability.updated",
  "faculty_availability.deleted",
  "faculty_subject_preference.created",
  "faculty_subject_preference.updated",
  "faculty_subject_preference.deleted",
  "section.created",
  "section.updated",
  "schedule_proposal.created",
  "schedule_proposal.dean_approved",
  "schedule_proposal.dean_returned",
  "schedule_proposal.executive_approved",
  "schedule_proposal.executive_returned",
  "schedule_proposal.published",
  "section.published",
  "schedule_proposal.closed",
  "student_profile.provisioned",
  "audit_log.list_viewed",
  "faculty_directory.list_viewed",
] as const
export const auditableTypes = [
  "curriculum",
  "faculty_availability",
  "faculty_subject_preference",
  "section",
  "schedule_proposal",
  "student_profile",
  "audit_log",
  "faculty_directory",
] as const
export const auditActionSchema = z.enum(auditActions)
export const auditableTypeSchema = z.enum(auditableTypes)

export const auditLogSchema = z
  .object({
    type: z.literal("audit_log"),
    id: z.number().int().positive(),
    actor_user_id: z.number().int().positive(),
    actor_role: z.enum(userRoles),
    actor_role_label: z.string().min(1),
    action: auditActionSchema,
    auditable_type: auditableTypeSchema,
    auditable_id: z.number().int().positive().nullable(),
    before_values: nullableObject,
    after_values: nullableObject,
    reason: z.string().nullable(),
    request_id: z.string().min(1).max(128),
    ip_address: z.string().max(45).nullable(),
    created_at: z.iso.datetime().nullable(),
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

export const paginatedAuditLogsSchema = z
  .object({
    data: z.array(auditLogSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const auditLogFiltersSchema = z
  .object({
    action: auditActionSchema.optional(),
    auditable_type: auditableTypeSchema.optional(),
    actor_user_id: z.number().int().positive().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export type AuditLog = z.infer<typeof auditLogSchema>
export type AuditLogFilters = z.input<typeof auditLogFiltersSchema>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
