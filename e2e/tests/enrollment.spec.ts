import { expect, test } from "@playwright/test"

import { SEED_STUDENT_SCENARIOS } from "../fixtures/seed-identities"

// Journey 6: Student eligibility, selection, and enrollment submission.
//
// student4.seed@grc.test is used rather than student.seed@grc.test:
// student1 already carries an active enrollment for the active term
// (DemoEnrollmentSeeder), which the workspace deliberately blocks a second
// submission against. student4's seeded enrollment is a terminal status
// (withdrawn), so they are eligible to submit fresh — no API arrangement
// needed, this journey drives the real UI end to end.

test("journey 6 — Student selects a subject's section and submits enrollment", async ({
  page,
}) => {
  // student4.seed@grc.test is a scenario account, not one of the 9 role
  // identities authenticateViaApi/signInViaUi cover — sign in via the real
  // login form directly.
  await page.goto("/login")
  await page.getByLabel("Email address").fill(SEED_STUDENT_SCENARIOS.withdrawn.email)
  await page.getByLabel("Password", { exact: true }).fill("password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/portal/)

  await page.goto("/portal/enrollment")
  await expect(
    page.getByRole("heading", { name: "Select your subjects" }),
  ).toBeVisible()

  await page.getByLabel("Academic term", { exact: true }).click()
  await page.getByRole("option", { name: "2026-2027 · 1st" }).click()

  const subjectCard = page.getByRole("article", { name: /^CS101 / })
  await expect(subjectCard).toBeVisible()
  await subjectCard.getByLabel("Section", { exact: true }).click()
  await page.getByRole("option").first().click()

  await expect(
    page.getByRole("heading", { name: "Review your enrollment" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Submit enrollment" }).click()

  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm submission" })
    .click()

  await expect(
    page.getByText(/Enrollment submitted and pending registrar approval/),
  ).toBeVisible()
})
