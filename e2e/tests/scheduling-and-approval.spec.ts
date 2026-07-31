import { expect, test } from "@playwright/test"

import { ApiArranger, loginAs } from "../fixtures/api-client"
import { authenticateViaApi } from "../fixtures/auth"
import { selectOption } from "../fixtures/select"

// Journey 4: Program Chair section creation and proposal submission.
// Journey 5: Dean and Executive Director schedule approval.
//
// Chained in one spec since journey 5's precondition (a draft proposal) is
// exactly journey 4's own output — arranging it a second way via the API
// would just re-implement journey 4. "Create draft proposal" already puts a
// proposal in the exact state UpdateScheduleProposalRequest requires for
// dean_approve — there is no separate "submit for review" step.
//
// Executive Director's half of journey 5 is exercised over the API, not the
// UI: ScheduleDecisionWorkspace is fully built to handle the
// executive_director role (its own test suite renders it with that role
// directly) and the backend fully accepts executive_approve — but
// role-capabilities.ts never wires a module id to ScheduleDecisionWorkspace
// for executive_director (only master-schedule, a separate read-only
// component, plus three placeholders). A real, previously undetected
// routing gap — vitest never caught it because rendering the component
// directly with a hand-picked session bypasses the module registry
// entirely. Not fixed here: wiring new navigation is an application feature
// change, out of this E2E-foundation phase's scope (see the spec's
// Non-goals) — recorded honestly rather than silently worked around with
// invented UI, the same way journey 13 handled its own missing-UI case.

test("journeys 4 & 5 — section creation, proposal submission, and Dean/Executive Director approval", async ({
  page,
  request,
}) => {
  // Journey 4a: Program Chair creates a section.
  await authenticateViaApi(page, request, "program_chair")
  await page.goto("/portal/sections-schedules")
  await expect(
    page.getByRole("heading", { name: "Sections and schedules" }),
  ).toBeVisible()

  // CS201 has no seeded section yet (SectionSeeder only covers CS101, CS102,
  // MATH101, GE101, PE101), avoiding the (term, subject, section_code)
  // uniqueness constraint entirely rather than picking a fresh section_code
  // letter for an already-used subject.
  await selectOption(page, "Subject", "CS201 — Computer Programming 2")
  await page.getByLabel("Section code", { exact: true }).fill("E2E")
  await page.getByLabel("Capacity", { exact: true }).fill("30")

  // No success banner or list renders in this create view — verify the
  // actual network result rather than a UI side effect that doesn't exist.
  const sectionCreated = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/sections") &&
      response.request().method() === "POST",
  )
  await page.getByRole("button", { name: "Save section" }).click()
  const sectionResponse = await sectionCreated
  expect(sectionResponse.status()).toBe(201)

  // Journey 4b: submit a draft schedule proposal for the active term.
  await page.goto("/portal/schedule-proposals")
  await expect(
    page.getByRole("heading", { name: "Schedule proposals" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Create draft proposal" }).click()

  const existingProposals = page.getByRole("region", {
    name: "Existing schedule proposals",
  })
  await expect(existingProposals.getByText("Draft")).toBeVisible()

  // Journey 5a: Dean approves.
  await authenticateViaApi(page, request, "dean")
  await page.goto("/portal/schedule-approvals")
  await expect(
    page.getByRole("heading", { name: "Schedule approvals" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Approve as Dean" }).first().click()
  await page.getByRole("button", { name: "Confirm decision" }).click()
  await expect(
    page.getByRole("button", { name: "Approve as Dean" }),
  ).toHaveCount(0)

  // Journey 5b: Executive Director approves — over the API (see the
  // routing-gap note above; no module id reaches ScheduleDecisionWorkspace
  // for this role today).
  const executiveSession = await loginAs(request, "executive_director")
  const executiveArranger = new ApiArranger(request, executiveSession)

  const proposals = (await executiveArranger.get(
    "/api/v1/schedule-proposals?per_page=50",
  )) as { data: { id: number; status: string }[] }
  const deanApproved = proposals.data.find(
    (p) => p.status === "dean_approved",
  )
  if (!deanApproved) {
    throw new Error(
      "No dean_approved proposal found for the Executive Director step.",
    )
  }

  const decision = (await executiveArranger.patch(
    `/api/v1/schedule-proposals/${deanApproved.id}`,
    { action: "executive_approve" },
  )) as { data: { status: string } }
  expect(decision.data.status).toBe("executive_approved")
})
