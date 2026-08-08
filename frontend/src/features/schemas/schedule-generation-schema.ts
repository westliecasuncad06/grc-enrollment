import { z } from "zod"

const facultyLoadAssignmentSchema = z
  .object({
    section_id: z.number().int().positive(),
    section_code: z.string().min(1),
    subject_id: z.number().int().positive(),
    subject_code: z.string().min(1),
    subject_title: z.string().min(1),
    units: z.number().nonnegative(),
    professor_id: z.number().int().positive().nullable(),
    professor_name: z.string().nullable(),
    recommended_professor_id: z.number().int().positive().nullable(),
    rationale: z.array(z.string()),
    override_reason: z.string().nullable(),
    schedule_days: z.string().nullable(),
    starts_at_time: z.string().nullable(),
    ends_at_time: z.string().nullable(),
    room: z.string().nullable(),
    modality: z.enum(["hyflex_a", "hyflex_b", "f2f"]).nullable(),
  })
  .strict()

export const facultyLoadReportSchema = z
  .object({
    academic_term_id: z.number().int().positive(),
    college: z.string().min(1),
    threshold_units: z.number().positive().nullable(),
    required_teaching_units: z.number().nonnegative(),
    required_assignments: z.number().int().nonnegative(),
    equivalent_faculty_loads: z.number().int().nonnegative().nullable(),
    assigned_count: z.number().int().nonnegative(),
    unassigned_count: z.number().int().nonnegative(),
    overloaded_count: z.number().int().nonnegative(),
    faculty: z.array(
      z
        .object({
          professor_id: z.number().int().positive(),
          professor_name: z.string().nullable(),
          total_units: z.number().nonnegative(),
          overloaded: z.boolean(),
          assignments: z.array(facultyLoadAssignmentSchema),
        })
        .strict(),
    ),
    unassigned: z.array(facultyLoadAssignmentSchema),
  })
  .strict()

const forecastSchema = z
  .object({
    subject_id: z.number().int().positive(),
    subject_code: z.string().min(1),
    subject_title: z.string().min(1),
    year_level: z.number().int().positive().nullable(),
    predicted_demand: z.number().nonnegative(),
    suggested_section_count: z.number().int().nonnegative(),
    confidence_lower: z.number().nonnegative().nullable(),
    confidence_upper: z.number().nonnegative().nullable(),
    historical_basis: z
      .object({
        school_year: z.string().nullable(),
        semester: z.string().nullable(),
        year_level: z.number().int().positive().nullable(),
      })
      .strict(),
    rationale: z.record(z.string(), z.unknown()),
  })
  .strict()

export const scheduleGenerationRunSchema = z
  .object({
    type: z.literal("schedule_generation_run"),
    id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    prediction_run_id: z.number().int().positive().nullable(),
    college: z.string().min(1),
    status: z.enum(["queued", "running", "succeeded", "partial", "failed"]),
    warnings: z.array(z.string()),
    error_summary: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    created_at: z.string().nullable(),
    model: z
      .object({
        strategy: z.enum(["random_forest", "historical_baseline"]).nullable(),
        model_version: z.string().nullable(),
        training_observation_count: z.number().int().nonnegative(),
        mae: z.number().nonnegative().nullable(),
        rmse: z.number().nonnegative().nullable(),
      })
      .strict()
      .optional(),
    forecasts: z.array(forecastSchema).optional(),
    section_block_recommendations: z
      .array(
        z
          .object({
            program_code: z.string().min(1),
            program_name: z.string().min(1),
            year_level: z.number().int().positive(),
            recommended_block_sections: z.number().int().nonnegative(),
            students_per_block: z.number().int().positive(),
            is_overridden: z.boolean(),
          })
          .strict(),
      )
      .optional(),
    faculty_load: facultyLoadReportSchema.optional(),
  })
  .strict()

export const scheduleGenerationRunEnvelopeSchema = z
  .object({ data: scheduleGenerationRunSchema })
  .strict()

export type ScheduleGenerationRun = z.infer<typeof scheduleGenerationRunSchema>
export type FacultyLoadReport = z.infer<typeof facultyLoadReportSchema>
