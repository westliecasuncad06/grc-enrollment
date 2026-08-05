/**
 * `YYYY-MM-NNNNN` — the year and month the account is provisioned in, plus a
 * random 5-digit suffix. `student_profiles.student_number` stays globally
 * unique at the database; a rare collision surfaces as an ordinary 422 the
 * Admission Staff can resolve by generating a new number.
 */
export function generateStudentNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const suffix = String(Math.floor(Math.random() * 100000)).padStart(5, "0")

  return `${year}-${month}-${suffix}`
}
