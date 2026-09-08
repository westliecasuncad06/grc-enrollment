import {
  hasScheduleConflict,
  parseScheduleDays,
} from "@/features/lib/schedule-order"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

export type RecommendationMode = "manual" | "concise" | "morning" | "afternoon"

type EligibleSection = EligibleSubject["available_sections"][number]

export interface RecommendationResult {
  mode: RecommendationMode
  recommendations: Record<number, number>
  totalSubjects: number
  matchedSubjects: number
  summary: string
  distinctDaysCount: number
}

interface SubjectChoiceOption {
  primarySection: EligibleSection
  pairedSection: EligibleSection | null
  morningScore: number
  afternoonScore: number
  days: number[]
}

interface SubjectChoiceItem {
  primarySubject: EligibleSubject
  pairedSubject: EligibleSubject | null
  options: SubjectChoiceOption[]
}

function computeSectionScores(section: EligibleSection): {
  morningScore: number
  afternoonScore: number
  days: number[]
} {
  const days = parseScheduleDays(section.schedule_days)
  let morningScore = 0
  let afternoonScore = 0

  if (section.starts_at_time && section.ends_at_time) {
    if (section.ends_at_time <= "13:00:00") {
      morningScore += 10
    } else if (section.starts_at_time < "12:00:00") {
      morningScore += 5
    } else {
      morningScore -= 10
    }

    if (section.starts_at_time >= "12:00:00") {
      afternoonScore += 10
    } else if (section.ends_at_time > "13:00:00") {
      afternoonScore += 5
    } else {
      afternoonScore -= 10
    }
  }

  return { morningScore, afternoonScore, days }
}

function buildChoiceItems(
  subjects: readonly EligibleSubject[],
): SubjectChoiceItem[] {
  const subjectById = new Map(
    subjects.map((subject) => [subject.subject_id, subject]),
  )
  const processedPairedIds = new Set<number>()
  const items: SubjectChoiceItem[] = []

  for (const subject of subjects) {
    if (processedPairedIds.has(subject.subject_id)) continue

    const pairedId = subject.paired_subject_id
    const paired = pairedId !== null ? (subjectById.get(pairedId) ?? null) : null

    if (paired) {
      processedPairedIds.add(paired.subject_id)
    }

    const options: SubjectChoiceOption[] = []

    for (const primarySection of subject.available_sections) {
      if (paired) {
        const matchingPaired = paired.available_sections.find(
          (p) => p.section_code === primarySection.section_code,
        )
        if (
          matchingPaired &&
          !hasScheduleConflict(primarySection, matchingPaired)
        ) {
          const primaryScores = computeSectionScores(primarySection)
          const pairedScores = computeSectionScores(matchingPaired)
          options.push({
            primarySection,
            pairedSection: matchingPaired,
            morningScore:
              primaryScores.morningScore + pairedScores.morningScore,
            afternoonScore:
              primaryScores.afternoonScore + pairedScores.afternoonScore,
            days: [...new Set([...primaryScores.days, ...pairedScores.days])],
          })
        }
      } else {
        const scores = computeSectionScores(primarySection)
        options.push({
          primarySection,
          pairedSection: null,
          morningScore: scores.morningScore,
          afternoonScore: scores.afternoonScore,
          days: scores.days,
        })
      }
    }

    items.push({
      primarySubject: subject,
      pairedSubject: paired,
      options,
    })
  }

  return items
}

/**
 * Generates conflict-free schedule recommendations for irregular students.
 * Supports 3 modes:
 * - "concise": packs subjects into the fewest distinct days (e.g. 1-2 days).
 * - "morning": prioritizes sections ending by 1:00 PM.
 * - "afternoon": prioritizes sections starting at or after 12:00 PM.
 */
export function generateScheduleRecommendation(
  subjects: readonly EligibleSubject[],
  mode: RecommendationMode,
): RecommendationResult {
  const totalSubjects = subjects.length
  if (totalSubjects === 0 || mode === "manual") {
    return {
      mode,
      recommendations: {},
      totalSubjects,
      matchedSubjects: 0,
      summary: "Manual selection active.",
      distinctDaysCount: 0,
    }
  }

  const items = buildChoiceItems(subjects)
  if (items.length === 0) {
    return {
      mode,
      recommendations: {},
      totalSubjects,
      matchedSubjects: 0,
      summary: "No subjects available for recommendation.",
      distinctDaysCount: 0,
    }
  }

  // Sort options within each item according to mode
  for (const item of items) {
    if (mode === "morning") {
      item.options.sort((a, b) => b.morningScore - a.morningScore)
    } else if (mode === "afternoon") {
      item.options.sort((a, b) => b.afternoonScore - a.afternoonScore)
    }
  }

  interface SolutionState {
    assignedCount: number
    selections: Record<number, number>
    sections: EligibleSection[]
    modeScore: number
    distinctDaysCount: number
  }

  let bestSolution: SolutionState = {
    assignedCount: -1,
    selections: {},
    sections: [],
    modeScore: -Infinity,
    distinctDaysCount: Infinity,
  }

  const isBetterSolution = (
    candidate: SolutionState,
    currentBest: SolutionState,
  ): boolean => {
    if (candidate.assignedCount > currentBest.assignedCount) return true
    if (candidate.assignedCount < currentBest.assignedCount) return false

    if (mode === "concise") {
      if (candidate.distinctDaysCount < currentBest.distinctDaysCount) return true
      if (candidate.distinctDaysCount > currentBest.distinctDaysCount) return false
      return candidate.modeScore > currentBest.modeScore
    }

    if (candidate.modeScore > currentBest.modeScore) return true
    if (candidate.modeScore < currentBest.modeScore) return false
    return candidate.distinctDaysCount < currentBest.distinctDaysCount
  }

  // Backtracking search across items
  function backtrack(
    itemIndex: number,
    currentSelections: Record<number, number>,
    currentSections: EligibleSection[],
    currentModeScore: number,
    currentDaySet: Set<number>,
    assignedSubjectsCount: number,
  ) {
    if (itemIndex >= items.length) {
      const state: SolutionState = {
        assignedCount: assignedSubjectsCount,
        selections: { ...currentSelections },
        sections: [...currentSections],
        modeScore: currentModeScore,
        distinctDaysCount: currentDaySet.size,
      }
      if (isBetterSolution(state, bestSolution)) {
        bestSolution = state
      }
      return
    }

    const item = items[itemIndex]
    const subjectUnitsCount = item.pairedSubject ? 2 : 1

    let hasChosenOption = false

    for (const option of item.options) {
      // Check conflict with currently selected sections
      let conflict = false
      for (const selected of currentSections) {
        if (hasScheduleConflict(option.primarySection, selected)) {
          conflict = true
          break
        }
        if (
          option.pairedSection &&
          hasScheduleConflict(option.pairedSection, selected)
        ) {
          conflict = true
          break
        }
      }

      if (conflict) continue

      hasChosenOption = true
      currentSelections[item.primarySubject.subject_id] = option.primarySection.id
      currentSections.push(option.primarySection)

      if (item.pairedSubject && option.pairedSection) {
        currentSelections[item.pairedSubject.subject_id] = option.pairedSection.id
        currentSections.push(option.pairedSection)
      }

      const addedDays: number[] = []
      for (const d of option.days) {
        if (!currentDaySet.has(d)) {
          currentDaySet.add(d)
          addedDays.push(d)
        }
      }

      const optionScore =
        mode === "morning"
          ? option.morningScore
          : mode === "afternoon"
            ? option.afternoonScore
            : -option.days.length

      backtrack(
        itemIndex + 1,
        currentSelections,
        currentSections,
        currentModeScore + optionScore,
        currentDaySet,
        assignedSubjectsCount + subjectUnitsCount,
      )

      // Backtrack
      for (const d of addedDays) {
        currentDaySet.delete(d)
      }
      currentSections.pop()
      delete currentSelections[item.primarySubject.subject_id]
      if (item.pairedSubject && option.pairedSection) {
        currentSections.pop()
        delete currentSelections[item.pairedSubject.subject_id]
      }

      // Optimization: if concise and all items already fit in 1 day (minimum possible), early branch termination
      if (
        mode === "concise" &&
        bestSolution.assignedCount === totalSubjects &&
        bestSolution.distinctDaysCount <= 1
      ) {
        return
      }
    }

    // Also allow skipping an item if it's impossible to schedule without conflict
    // (branch continues so other subjects can still be matched)
    if (!hasChosenOption || bestSolution.assignedCount < totalSubjects) {
      backtrack(
        itemIndex + 1,
        currentSelections,
        currentSections,
        currentModeScore - 50,
        currentDaySet,
        assignedSubjectsCount,
      )
    }
  }

  backtrack(0, {}, [], 0, new Set(), 0)

  const matched = bestSolution.assignedCount > 0 ? bestSolution.assignedCount : 0
  const modeLabels: Record<RecommendationMode, string> = {
    manual: "Manual",
    concise: "Concise (1–2 Days)",
    morning: "Morning Classes",
    afternoon: "Afternoon / Evening Classes",
  }

  const daysCount = bestSolution.distinctDaysCount === Infinity ? 0 : bestSolution.distinctDaysCount

  let summary = ""
  if (matched === totalSubjects) {
    if (mode === "concise") {
      summary = `All ${matched} subjects packed into ${daysCount} day${daysCount === 1 ? "" : "s"} with no schedule conflicts.`
    } else {
      summary = `All ${matched} subjects scheduled in ${modeLabels[mode]} with no schedule conflicts.`
    }
  } else if (matched > 0) {
    summary = `${matched} of ${totalSubjects} subjects scheduled without conflict. ${totalSubjects - matched} subject(s) require manual selection.`
  } else {
    summary = `No conflict-free combination found for ${modeLabels[mode]}. Try manual selection.`
  }

  return {
    mode,
    recommendations: bestSolution.selections,
    totalSubjects,
    matchedSubjects: matched,
    summary,
    distinctDaysCount: daysCount,
  }
}
