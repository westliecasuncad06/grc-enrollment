"use client"

import { useCallback, useState } from "react"

import type {
  ProvisionStudentInput,
  StudentProfile,
} from "@/features/schemas/admission-schema"
import { generateTemporaryCredential } from "@/features/lib/temporary-credential"
import { provisionStudent } from "@/features/services/admission-service"

type ProvisioningFields = Omit<ProvisionStudentInput, "password">

interface ProvisioningReceipt {
  credential: string
  profile: StudentProfile
}

/**
 * Keeps a generated credential out of query caches and component form state.
 * It exists only for the request and the success receipt returned to the
 * caller; failed attempts discard it immediately.
 */
export function useStudentProvisioning() {
  const [isProvisioning, setIsProvisioning] = useState(false)

  const provision = useCallback(
    async (
      fields: ProvisioningFields,
      generateCredential: () => string = generateTemporaryCredential,
    ): Promise<ProvisioningReceipt> => {
      setIsProvisioning(true)
      const credential = generateCredential()

      try {
        const profile = await provisionStudent({
          ...fields,
          password: credential,
        })
        return { credential, profile }
      } finally {
        setIsProvisioning(false)
      }
    },
    [],
  )

  return { isProvisioning, provision }
}
