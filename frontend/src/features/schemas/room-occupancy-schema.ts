import { z } from "zod"

export const roomOccupancyEntrySchema = z
  .object({
    type: z.literal("room_occupancy"),
    section_id: z.number().int().positive(),
    section_code: z.string().min(1),
    subject_code: z.string().min(1),
    subject_title: z.string().min(1),
    professor_name: z.string().nullable(),
    schedule_days: z.string().nullable(),
    starts_at_time: z.string().nullable(),
    ends_at_time: z.string().nullable(),
    modality: z.enum(["hyflex_a", "hyflex_b", "f2f"]).nullable(),
    college: z.string().nullable(),
    is_own_college: z.boolean(),
    is_lecture_component: z.boolean(),
  })
  .strict()

export const roomOccupancyEnvelopeSchema = z
  .object({ data: z.array(roomOccupancyEntrySchema) })
  .strict()

export type RoomOccupancyEntry = z.infer<typeof roomOccupancyEntrySchema>
