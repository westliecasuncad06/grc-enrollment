import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CertificateOfRegistrationDocument } from "@/features/components/portal/certificate-of-registration-document"
import type {
  CertificateOfRegistration,
  CorSnapshot,
} from "@/features/schemas/enrollment-document-schema"

const cor = {
  type: "certificate_of_registration",
  id: 1,
  enrollment_id: 9,
  document_number: "COR000009",
  generated_at: "2026-07-30T00:00:00Z",
  content_hash: "abc123",
  snapshot: {
    document_title: "Certificate of Registration",
    institution: {
      name: "Global Reciprocal Colleges",
      address:
        "GRC Building, 454, 1400 Rizal Ave Ext, East Grace Park, Caloocan, Metro Manila",
    },
    student: {
      student_number: "2026-0001",
      name: "Test Student",
      address: "123 Test Drive, Caloocan City",
      course: "BS Information Technology",
      level: "Year 4",
      platform: "Not provided",
    },
    term: { school_year: "2026-2027", semester: "1st" },
    subjects: [
      {
        code: "IT401",
        title: "Business Analytics",
        units: "3.00",
        section: "IV-BLOCK",
        schedule_id: "40882",
        schedule: "10:30 AM - 01:30 PM Mon",
        room: "Hybrid Flexible Learning (HyFlex)",
      },
    ],
    total_units: "3.00",
    admission_certification:
      "This is to certify that Test Student is cleared and enrolled.",
    fees: {
      currency: "PHP",
      tuition: [
        {
          label: "Tuition fee",
          quantity: "3.00",
          unit_amount: "900.00",
          amount: "2700.00",
        },
      ],
      other_fees: [
        {
          label: "Registration",
          quantity: null,
          unit_amount: null,
          amount: "200.00",
        },
      ],
      total_tuition: "2700.00",
      total_other_fees: "200.00",
      grand_total: "2900.00",
      payment_amount: "2900.00",
    },
    signatories: { cashier: "Cashier Test", registrar: "Registrar" },
    withdrawal_terms: [
      "1. Period of Withdrawal. Withdrawal may be validly effected only within the approved period.",
    ],
  },
} satisfies CertificateOfRegistration & { snapshot: CorSnapshot }

describe("CertificateOfRegistrationDocument", () => {
  it("renders the official two-page COR record with subjects, assessment, and terms", () => {
    render(<CertificateOfRegistrationDocument cor={cor} />)

    expect(screen.getAllByText("CERTIFICATE OF REGISTRATION")).toHaveLength(2)
    expect(screen.getByText("Business Analytics")).toBeInTheDocument()
    expect(
      screen.queryByRole("columnheader", { name: "Room" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("ASSESSMENT OF FEES")).toBeInTheDocument()
    expect(
      screen.getByText("Guidance and Counseling and Student Affair"),
    ).toBeInTheDocument()
    expect(screen.getByText("Library Fee")).toBeInTheDocument()
    expect(screen.getByText("GRAND TOTAL")).toBeInTheDocument()
    expect(
      screen.getByText("TERMS AND CONDITIONS GOVERNING WITHDRAWAL"),
    ).toBeInTheDocument()
    expect(screen.getByText("Cashier Test")).toBeInTheDocument()
    expect(screen.getByText("COR000009")).toBeInTheDocument()
  })
})
