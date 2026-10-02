import { describe, expect, it } from "vitest"

import {
  notificationDestinationPath,
  notificationPresentation,
} from "@/features/lib/notification-presentation"

describe("notificationDestinationPath", () => {
  it.each([
    ["curriculum_submitted_for_dean", "dean", "/portal/curriculum-approvals"],
    [
      "curriculum_dean_approved",
      "executive_director",
      "/portal/curriculum-approvals",
    ],
    [
      "curriculum_dean_approved",
      "program_chair",
      "/portal/subjects-prerequisites",
    ],
    ["curriculum_returned", "dean", "/portal/curriculum-approvals"],
    [
      "curriculum_executive_approved",
      "program_chair",
      "/portal/subjects-prerequisites",
    ],
  ] as const)(
    "sends %s to %s at %s, a workspace that role has",
    (type, role, path) => {
      expect(notificationDestinationPath(type, role)).toBe(path)
    },
  )

  it.each([
    ["enrollment_submitted", "registrar_staff"],
    ["enrollment_submitted", "registrar_head"],
    ["enrollment_program_head_approved", "registrar_staff"],
    ["enrollment_program_head_approved", "registrar_head"],
  ] as const)(
    "opens Enrollment Approvals for the Registrar on %s (%s)",
    (type, role) => {
      expect(notificationDestinationPath(type, role)).toBe(
        "/portal/enrollment-approvals",
      )
    },
  )

  it.each([
    ["enrollment_revision_accepted", "program_chair", "/portal/irregular-enrollments"],
    ["enrollment_revision_declined", "program_chair", "/portal/irregular-enrollments"],
    ["enrollment_program_head_subjects_revised", "student", "/portal/enrollment"],
  ] as const)(
    "sends %s to %s at %s (the student answers in Enrollment, the Chair reads it in Irregular Advising)",
    (type, role, path) => {
      expect(notificationDestinationPath(type, role)).toBe(path)
    },
  )

  it("shows the student's answer to the Program Chair's changes with its own label", () => {
    expect(notificationPresentation("enrollment_revision_accepted").tone).toBe("success")
    expect(notificationPresentation("enrollment_revision_declined").tone).toBe("destructive")
  })

  it("keeps the student on Enrollment for their own enrollment, request and withdrawal updates", () => {
    for (const type of [
      "enrollment_program_head_approved",
      "enrollment_registrar_approved",
      "enrollment_change_request_submitted",
      "enrollment_change_request_approved",
      "enrollment_change_request_rejected",
      "withdrawal_request_approved",
      "withdrawal_request_rejected",
    ]) {
      expect(notificationDestinationPath(type, "student")).toBe(
        "/portal/enrollment",
      )
    }
  })

  it("opens the Enrollment Requests hub for a new withdrawal or change request", () => {
    expect(
      notificationDestinationPath(
        "withdrawal_request_submitted",
        "registrar_head",
      ),
    ).toBe("/portal/enrollment-requests")
    expect(
      notificationDestinationPath(
        "withdrawal_request_submitted",
        "registrar_staff",
      ),
    ).toBe("/portal/enrollment-requests")
    expect(
      notificationDestinationPath(
        "enrollment_change_request_submitted",
        "registrar_head",
      ),
    ).toBe("/portal/enrollment-requests")
    expect(
      notificationDestinationPath("withdrawal_request_submitted", "student"),
    ).toBeNull()
  })

  it("sends a professor whose section was swapped to their teaching schedule", () => {
    expect(
      notificationDestinationPath("section_professor_reassigned", "faculty"),
    ).toBe("/portal/teaching-schedule")
    expect(
      notificationDestinationPath(
        "section_professor_reassigned",
        "registrar_head",
      ),
    ).toBe("/portal/submitted-schedules")
  })

  it("labels a new withdrawal request", () => {
    expect(notificationPresentation("withdrawal_request_submitted").label).toBe(
      "Withdrawal requested",
    )
  })
})
