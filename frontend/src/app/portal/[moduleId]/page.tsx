import { PortalModulePage } from "@/features/components/pages/portal-module-page"

export default async function Page({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params

  return <PortalModulePage moduleId={moduleId} />
}
