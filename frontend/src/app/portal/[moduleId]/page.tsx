import { PortalModulePage } from "@/features/components/pages/portal-module-page"
import { redirect } from "next/navigation"

const legacyModuleRedirects: Record<string, string> = {
  "demand-forecast": "program-chair-enrollment",
  "faculty-assignment": "schedule-faculty-loading",
  "sections-schedules": "schedule-faculty-loading",
}

export default async function Page({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params

  const redirectedModule = legacyModuleRedirects[moduleId]
  if (redirectedModule) {
    redirect(`/portal/${redirectedModule}`)
  }

  return <PortalModulePage moduleId={moduleId} />
}
