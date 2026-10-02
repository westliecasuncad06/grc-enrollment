import { formatGeneratedAt } from "@/features/lib/format-generated-at"
import { formatYearLevel } from "@/features/lib/format-year-level"
import type {
  CertificateOfRegistration,
  CorSnapshot,
} from "@/features/schemas/enrollment-document-schema"

/**
 * Issued snapshots keep the raw "Year N" wording (the COR endpoint re-saves a
 * row whenever a rebuilt snapshot differs), so the institution-approved
 * "1st Year" form is applied here when rendering, legacy snapshots included.
 */
function ordinalizeYearLevels(sentence: string): string {
  return sentence.replace(/\bYear (\d+)\b/g, (_match, level: string) =>
    formatYearLevel(level),
  )
}

type RenderableCor = CertificateOfRegistration & { snapshot: CorSnapshot }

/** Official immutable record rendered solely from the payment-time COR snapshot. */
export function CertificateOfRegistrationDocument({
  cor,
  watermark,
}: {
  cor: RenderableCor
  /** Set for an unofficial preview: shown as a banner above the document. */
  watermark?: string
}) {
  const { snapshot } = cor
  const { student, institution, term } = snapshot

  return (
    <article
      className="cor-document"
      aria-label={`Certificate of Registration ${cor.document_number}`}
    >
      <section className="cor-document__page">
        {watermark && (
          <p
            role="note"
            className="mb-2 rounded border border-dashed border-destructive/60 bg-destructive/5 p-2 text-center text-xs font-semibold uppercase tracking-wide text-destructive"
          >
            {watermark}
          </p>
        )}
        <header className="cor-document__header">
          <p>{institution.name}</p>
          <small>{institution.address}</small>
          <h1>CERTIFICATE OF REGISTRATION</h1>
        </header>

        <div className="cor-document__facts">
          <dl>
            <dt>Student No.</dt>
            <dd>{student.student_number}</dd>
            <dt>Name</dt>
            <dd>{student.name}</dd>
            <dt>Degree</dt>
            <dd>{student.course}</dd>
            <dt>Classification</dt>
            <dd className="font-semibold text-primary">
              {student.classification ?? "Payee"}
            </dd>
            <dt>Address</dt>
            <dd>{student.address}</dd>
          </dl>
          <dl>
            <dt>Academic Year</dt>
            <dd>{term.school_year}</dd>
            <dt>Semester</dt>
            <dd>{term.semester}</dd>
            <dt>Year Level</dt>
            <dd>{formatYearLevel(student.level)}</dd>
            <dt>Platform</dt>
            <dd>{student.platform}</dd>
          </dl>
        </div>

        <table>
          <caption>Registered subjects for {cor.document_number}</caption>
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject</th>
              <th>Unit</th>
              <th>Section</th>
              <th>Schedule ID</th>
              <th>Schedule</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.subjects.map((subject) => (
              <tr key={`${subject.code}-${subject.schedule_id}`}>
                <td>{subject.code}</td>
                <td>{subject.title}</td>
                <td>{subject.units}</td>
                <td>{subject.section}</td>
                <td>{subject.schedule_id}</td>
                <td>{subject.schedule}</td>
              </tr>
            ))}
            <tr className="cor-document__total-row">
              <td colSpan={2}>TOTAL</td>
              <td>{snapshot.total_units}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>

        <section className="cor-document__admission">
          <h2>ADMISSION FORM</h2>
          <p>{ordinalizeYearLevels(snapshot.admission_certification)}</p>
        </section>
        {/* Fees, payments, and balance are deliberately not on the COR (stakeholder
            Doc 16) — they live in the Statement of Account. */}
      </section>

      <section className="cor-document__page cor-document__page--terms">
        <header className="cor-document__header cor-document__header--compact">
          <p>{institution.name}</p>
          <small>{institution.address}</small>
          <h1>CERTIFICATE OF REGISTRATION</h1>
        </header>
        <div className="cor-document__reference">
          <span>{student.name}</span>
          <span>{student.student_number}</span>
          <span>
            {term.school_year} · {term.semester}
          </span>
          <span>{cor.document_number}</span>
        </div>
        <section className="cor-document__terms">
          <h2>TERMS AND CONDITIONS GOVERNING WITHDRAWAL</h2>
          <ol>
            {snapshot.withdrawal_terms.map((termText, index) => {
              const cleanedText = termText.replace(/^\d+\.\s*/, "")
              return (
                <li key={`${index}-${cleanedText.slice(0, 15)}`}>
                  <strong>{index + 1}. </strong>
                  {cleanedText}
                </li>
              )
            })}
          </ol>
        </section>
        <footer className="cor-document__signatures">
          <div>
            <span>{snapshot.signatories.cashier}</span>
            <strong>CASHIER</strong>
          </div>
          <div>
            <span>{student.name}</span>
            <strong>STUDENT'S SIGNATURE OVER PRINTED NAME</strong>
          </div>
          <div>
            <span>{snapshot.signatories.registrar}</span>
            <strong>REGISTRAR</strong>
          </div>
        </footer>
        <p className="cor-document__footer">
          Generated {formatGeneratedAt(cor.generated_at)} ·{" "}
          {cor.document_number}
        </p>
      </section>
    </article>
  )
}
