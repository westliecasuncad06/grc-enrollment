import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  Landmark,
  Users,
} from "lucide-react"
import Link from "next/link"

import { PublicApiReadiness } from "@/features/components/common/public-api-readiness"
import { PublicFooter } from "@/features/components/layouts/public-footer"
import { PublicHeader } from "@/features/components/layouts/public-header"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"

const audiencePaths = [
  {
    title: "Students",
    description:
      "Choose eligible subjects, follow authorized review, and move toward payment confirmation and a finalized Digital COM.",
    icon: GraduationCap,
  },
  {
    title: "Faculty & Program Chairs",
    description:
      "Coordinate availability, class assignments, curriculum, sections, and schedule proposals in role-aware workspaces.",
    icon: Users,
  },
  {
    title: "Enrollment offices & leadership",
    description:
      "Admissions, Registrar, Accounting, Dean, and Executive offices review the records and decisions assigned to them.",
    icon: Landmark,
  },
] as const

const enrollmentJourney = [
  {
    title: "Schedule preparation",
    description:
      "Academic teams prepare curriculum, sections, assignments, and reviewable schedules.",
    icon: ClipboardList,
  },
  {
    title: "Student subject selection and submission",
    description:
      "Students review eligible subjects and submit an enrollment request.",
    icon: BookOpenCheck,
  },
  {
    title: "Authorized review and approval",
    description:
      "Assigned offices evaluate the request through governed role boundaries.",
    icon: CheckCheck,
  },
  {
    title: "Payment confirmation and Digital COM finalization",
    description:
      "Accounting confirms verified payment before the registration record is finalized.",
    icon: Building2,
  },
] as const

export function LandingPage() {
  return (
    <div className="institutional-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy reveal reveal--one">
            <p className="eyebrow">
              <Landmark aria-hidden="true" />
              One guided enrollment record
            </p>
            <h1 id="landing-title">
              Enrollment, guided from first step to final record.
            </h1>
            <p className="landing-hero__summary">
              Coordinate schedules, subject selection, authorized approvals,
              payment confirmation, and academic records through one role-aware
              enrollment experience.
            </p>
            <div className="landing-actions">
              <Button asChild size="lg">
                <Link href="/login">
                  Sign in to portal
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#system-readiness">
                  View system readiness
                  <ArrowDown data-icon="inline-end" aria-hidden="true" />
                </a>
              </Button>
            </div>
            <p className="landing-boundary">
              Public information only. Sign-in currently opens a clearly labeled
              local interface demonstration.
            </p>
          </div>

          <aside
            className="enrollment-folio reveal reveal--two"
            aria-label="Enrollment journey folio"
          >
            <div className="enrollment-folio__header">
              <span>Enrollment folio</span>
              <strong>One coordinated path</strong>
            </div>
            <ol>
              {enrollmentJourney.map((step, index) => {
                const Icon = step.icon

                return (
                  <li key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Icon aria-hidden="true" />
                    <strong>{step.title}</strong>
                  </li>
                )
              })}
            </ol>
            <p>
              Each handoff belongs to an authorized role. The public landing
              page exposes no enrollment record.
            </p>
          </aside>
        </section>

        <section
          id="portal-guide"
          className="audience-section"
          aria-labelledby="portal-guide-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Portal guide</p>
              <h2 id="portal-guide-title">One system, many responsibilities</h2>
            </div>
            <p>
              Each person enters a workspace shaped around their part of the
              enrollment record—not a one-size-fits-all dashboard.
            </p>
          </div>

          <div className="audience-grid">
            {audiencePaths.map((path, index) => {
              const Icon = path.icon

              return (
                <Card key={path.title} className="audience-card">
                  <CardHeader>
                    <div className="audience-card__marker">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Icon aria-hidden="true" />
                    </div>
                    <CardTitle role="heading" aria-level={3}>
                      {path.title}
                    </CardTitle>
                    <CardDescription>{path.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span>Role-guided portal preview</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="journey-section" aria-labelledby="journey-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Enrollment journey</p>
              <h2 id="journey-title">From schedule to final record</h2>
            </div>
            <p>
              Four connected stages make the process legible while keeping
              approvals and records inside their authorized boundaries.
            </p>
          </div>

          <ol className="journey-list">
            {enrollmentJourney.map((step, index) => {
              const Icon = step.icon

              return (
                <li key={step.title}>
                  <div className="journey-list__index">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <PublicApiReadiness />
      </main>

      <PublicFooter />
    </div>
  )
}
