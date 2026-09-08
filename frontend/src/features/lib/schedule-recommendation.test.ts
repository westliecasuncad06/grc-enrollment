import { describe, expect, it } from "vitest"

import { generateScheduleRecommendation } from "@/features/lib/schedule-recommendation"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

function makeSection(
  overrides: Partial<EligibleSubject["available_sections"][number]> = {},
): EligibleSubject["available_sections"][number] {
  return {
    type: "section",
    id: 1,
    academic_term_id: 1,
    subject_id: 1,
    section_code: "SEC-1",
    professor_id: null,
    schedule_days: "MON",
    starts_at_time: "08:00:00",
    ends_at_time: "10:00:00",
    room: "R101",
    capacity: 40,
    capacity_source: "plan",
    viability_threshold: null,
    enrolled_count: 0,
    remaining_seats: 40,
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    college: "ccs",
    is_own_department: true,
    subject_code: "CS101",
    subject_title: "Programming 1",
    ...overrides,
  }
}

function makeSubject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
  return {
    type: "eligible_subject",
    subject_id: 1,
    code: "CS101",
    title: "Programming 1",
    units: 3,
    paired_subject_id: null,
    year_level: 1,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [],
    preference_score: null,
    preference_reasons: [],
    available_sections: [makeSection()],
    ...overrides,
  }
}

describe("schedule-recommendation", () => {
  it("returns empty recommendations for manual mode", () => {
    const subjects = [makeSubject()]
    const result = generateScheduleRecommendation(subjects, "manual")

    expect(result.mode).toBe("manual")
    expect(result.recommendations).toEqual({})
  })

  it("recommends morning sections in morning mode", () => {
    const morningSection = makeSection({
      id: 101,
      section_code: "MORN",
      schedule_days: "MON",
      starts_at_time: "08:00:00",
      ends_at_time: "11:00:00",
    })
    const afternoonSection = makeSection({
      id: 102,
      section_code: "AFT",
      schedule_days: "MON",
      starts_at_time: "14:00:00",
      ends_at_time: "17:00:00",
    })

    const subject1 = makeSubject({
      subject_id: 1,
      available_sections: [afternoonSection, morningSection],
    })

    const result = generateScheduleRecommendation([subject1], "morning")

    expect(result.mode).toBe("morning")
    expect(result.matchedSubjects).toBe(1)
    expect(result.recommendations[1]).toBe(101)
  })

  it("recommends afternoon sections in afternoon mode", () => {
    const morningSection = makeSection({
      id: 201,
      section_code: "MORN",
      schedule_days: "TUE",
      starts_at_time: "08:00:00",
      ends_at_time: "11:00:00",
    })
    const afternoonSection = makeSection({
      id: 202,
      section_code: "AFT",
      schedule_days: "TUE",
      starts_at_time: "13:00:00",
      ends_at_time: "16:00:00",
    })

    const subject1 = makeSubject({
      subject_id: 1,
      available_sections: [morningSection, afternoonSection],
    })

    const result = generateScheduleRecommendation([subject1], "afternoon")

    expect(result.mode).toBe("afternoon")
    expect(result.matchedSubjects).toBe(1)
    expect(result.recommendations[1]).toBe(202)
  })

  it("packs schedules into minimum days in concise mode", () => {
    // Subject 1 has options on Monday or Wednesday
    const s1Mon = makeSection({
      id: 301,
      subject_id: 1,
      section_code: "M1",
      schedule_days: "MON",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
    })
    const s1Wed = makeSection({
      id: 302,
      subject_id: 1,
      section_code: "W1",
      schedule_days: "WED",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
    })

    // Subject 2 has options on Monday (non-conflicting with s1Mon) or Friday
    const s2Mon = makeSection({
      id: 303,
      subject_id: 2,
      section_code: "M2",
      schedule_days: "MON",
      starts_at_time: "10:30:00",
      ends_at_time: "12:30:00",
    })
    const s2Fri = makeSection({
      id: 304,
      subject_id: 2,
      section_code: "F2",
      schedule_days: "FRI",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
    })

    const subject1 = makeSubject({
      subject_id: 1,
      available_sections: [s1Wed, s1Mon],
    })
    const subject2 = makeSubject({
      subject_id: 2,
      available_sections: [s2Fri, s2Mon],
    })

    const result = generateScheduleRecommendation([subject1, subject2], "concise")

    expect(result.mode).toBe("concise")
    expect(result.matchedSubjects).toBe(2)
    // Should pack both on Monday (1 distinct day)
    expect(result.distinctDaysCount).toBe(1)
    expect(result.recommendations[1]).toBe(301)
    expect(result.recommendations[2]).toBe(303)
  })

  it("handles paired lecture and lab components together without conflicts", () => {
    const lecSecA = makeSection({
      id: 401,
      subject_id: 10,
      section_code: "A",
      schedule_days: "MON",
      starts_at_time: "08:00:00",
      ends_at_time: "10:00:00",
    })
    const labSecA = makeSection({
      id: 402,
      subject_id: 11,
      section_code: "A",
      schedule_days: "MON",
      starts_at_time: "10:00:00",
      ends_at_time: "13:00:00",
    })

    const lecA = makeSubject({
      subject_id: 10,
      code: "CS101",
      paired_subject_id: 11,
      available_sections: [lecSecA],
    })
    const labA = makeSubject({
      subject_id: 11,
      code: "CS101L",
      paired_subject_id: 10,
      available_sections: [labSecA],
    })

    const result = generateScheduleRecommendation([lecA, labA], "morning")

    expect(result.matchedSubjects).toBe(2)
    expect(result.recommendations[10]).toBe(401)
    expect(result.recommendations[11]).toBe(402)
  })
})

