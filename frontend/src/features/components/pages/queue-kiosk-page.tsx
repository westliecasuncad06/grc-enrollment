"use client"

import { LogOutIcon } from "lucide-react"

import { QueueKioskDeviceLogin } from "@/features/components/kiosk/queue-kiosk-device-login"
import { QueueKioskStudentLogin } from "@/features/components/kiosk/queue-kiosk-student-login"
import { QueueKioskStudentSession } from "@/features/components/kiosk/queue-kiosk-student-session"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useQueueKioskSession } from "@/features/hooks/use-queue-kiosk-session"

export function QueueKioskPage() {
  const { state, finishStudent, signInDevice, signInStudent, signOutDevice } =
    useQueueKioskSession()

  if (state.status === "restoring-device") {
    return (
      <main className="queue-kiosk-shell">
        <p
          className="queue-kiosk-restoring"
          role="status"
          aria-label="Restoring Queue Kiosk"
        >
          Restoring Queue Kiosk…
        </p>
      </main>
    )
  }

  const deviceHeader = (
    <header className="queue-kiosk-header">
      <div>
        <p className="queue-kiosk-eyebrow">Global Reciprocal Colleges</p>
        <h1>Cashier Queue Kiosk</h1>
      </div>
      {state.status !== "device-login" && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void signOutDevice()}
        >
          <LogOutIcon data-icon="inline-start" />
          Sign out device
        </Button>
      )}
    </header>
  )

  if (state.status === "device-login") {
    return (
      <main className="queue-kiosk-shell">
        {deviceHeader}
        <Card className="queue-kiosk-card">
          <CardHeader>
            <CardTitle>Queue Kiosk sign-in</CardTitle>
            <CardDescription>
              Authorized Cashier staff: unlock this device before assisting a
              Student.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QueueKioskDeviceLogin
              error={state.error}
              onSubmit={signInDevice}
            />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (state.status === "student-login") {
    return (
      <main className="queue-kiosk-shell">
        {deviceHeader}
        <Card className="queue-kiosk-card">
          <CardHeader>
            <CardTitle>Student sign-in</CardTitle>
            <CardDescription>
              Enter your account only to view or claim your own Cashier queue
              number. Your details are cleared when you finish.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QueueKioskStudentLogin
              error={state.error}
              onSubmit={signInStudent}
            />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <QueueKioskStudentSession
      key={`${state.kioskToken}:${state.studentToken}`}
      state={state}
      finishStudent={finishStudent}
      signOutDevice={signOutDevice}
    />
  )
}
