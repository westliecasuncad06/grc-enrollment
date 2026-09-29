"use client"

import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"

import { isAuthError } from "@/features/auth/auth-error"
import { useAuth } from "@/features/auth/use-auth"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void
        }
      }
    }
  }
}

interface GoogleSignInButtonProps {
  /** Called once `signInWithGoogle` has established a session. */
  onSignedIn: () => void
}

const notFoundMessage =
  "No GRC account was found for this Google email. Please contact Admission or the Registrar's Office to have your account created."
const genericErrorMessage =
  "Google sign-in could not be completed. Please try again."

/**
 * Renders Google's own "Sign in with Google" button via the Identity
 * Services JS SDK — the frontend receives a signed ID token directly in this
 * callback and posts it once to `POST /auth/google`; no redirect, no client
 * secret. Renders nothing when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unset, so an
 * environment that hasn't configured Google yet simply shows no button
 * rather than a broken one.
 */
export function GoogleSignInButton({ onSignedIn }: GoogleSignInButtonProps) {
  const { signInWithGoogle } = useAuth()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredential = useCallback(
    (response: { credential: string }) => {
      setError(null)
      void (async () => {
        try {
          await signInWithGoogle(response.credential)
          onSignedIn()
        } catch (cause) {
          setError(
            isAuthError(cause) && cause.code === "GOOGLE_ACCOUNT_NOT_FOUND"
              ? notFoundMessage
              : genericErrorMessage,
          )
        }
      })()
    },
    [signInWithGoogle, onSignedIn],
  )

  useEffect(() => {
    if (
      !scriptLoaded ||
      !clientId ||
      !containerRef.current ||
      !window.google
    ) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    })

    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: 320,
    })
  }, [scriptLoaded, clientId, handleCredential])

  if (!clientId) {
    return null
  }

  return (
    <div className="google-sign-in">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} className="google-sign-in-button" />
      {error && (
        <Alert variant="destructive" className="google-sign-in-alert">
          <AlertTitle>Google sign-in unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
