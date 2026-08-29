"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { getRoomOccupancy } from "@/features/services/room-occupancy-service"

export const roomOccupancyQueryKey = (
  userId: string | null,
  room: string | null,
  academicTermId: number,
) => ["room-occupancy", userId, room, academicTermId] as const

export function useRoomOccupancyQuery(room: string | null, academicTermId: number) {
  const { session } = useAuth()

  return useQuery({
    queryKey: roomOccupancyQueryKey(session?.userId ?? null, room, academicTermId),
    queryFn: ({ signal }) => getRoomOccupancy(room ?? "", academicTermId, signal),
    enabled: session !== null && room !== null && academicTermId > 0,
  })
}
