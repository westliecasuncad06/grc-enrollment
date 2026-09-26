/**
 * Keeps a lecture and its paired laboratory next to each other in a list
 * (stakeholder Doc 14: they are always taken together and meet back-to-back,
 * so the picker should show them together whatever the sort order).
 *
 * Each row stays where it was, except that a row's partner, when it is also in
 * the list, is pulled up to sit directly after it. A row whose partner is not
 * in the list is left alone. The input is not modified.
 */
export function groupPairedSubjects<
  T extends { subject_id: number; paired_subject_id: number | null },
>(rows: readonly T[]): T[] {
  const bySubjectId = new Map(rows.map((row) => [row.subject_id, row]))
  const placed = new Set<number>()
  const grouped: T[] = []

  for (const row of rows) {
    if (placed.has(row.subject_id)) continue

    grouped.push(row)
    placed.add(row.subject_id)

    const partner =
      row.paired_subject_id === null
        ? undefined
        : bySubjectId.get(row.paired_subject_id)

    if (partner && !placed.has(partner.subject_id)) {
      grouped.push(partner)
      placed.add(partner.subject_id)
    }
  }

  return grouped
}
