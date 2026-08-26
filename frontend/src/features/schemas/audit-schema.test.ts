import { describe, expect, it } from "vitest"

import {
  auditActionSchema,
  auditLogFiltersSchema,
  auditLogSchema,
  auditableTypeSchema,
} from "@/features/schemas/audit-schema"

describe("queue kiosk audit vocabulary", () => {
  it.each(["queue_kiosk_credential.viewed", "queue_kiosk.password_changed"])(
    "accepts %s as a filterable action",
    (action) => {
      expect(auditActionSchema.parse(action)).toBe(action)
      expect(auditLogFiltersSchema.parse({ action }).action).toBe(action)
    },
  )

  it("accepts queue kiosk credentials as a filterable resource type", () => {
    expect(auditableTypeSchema.parse("queue_kiosk_credential")).toBe(
      "queue_kiosk_credential",
    )
    expect(
      auditLogFiltersSchema.parse({ auditable_type: "queue_kiosk_credential" })
        .auditable_type,
    ).toBe("queue_kiosk_credential")
  })

  it("continues accepting new non-filterable action strings in audit resources", () => {
    expect(
      auditLogSchema.parse({
        type: "audit_log",
        id: 1,
        actor_user_id: 1,
        actor_role: "accounting_staff",
        actor_role_label: "Accounting Staff",
        action: "future.action",
        auditable_type: "future_resource",
        auditable_id: 1,
        before_values: null,
        after_values: null,
        reason: null,
        request_id: "request-1",
        ip_address: null,
        created_at: "2026-08-23T00:00:00Z",
      }).action,
    ).toBe("future.action")
  })
})
