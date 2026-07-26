import { ArrowRight } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/app/components/ui/button"

export function PublicHeader() {
  return (
    <header className="site-masthead public-masthead">
      <Link
        className="institutional-identity rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        to="/"
        aria-label="Global Reciprocal Colleges enrollment home"
      >
        <span className="grc-monogram" aria-hidden="true">
          GRC
        </span>
        <span>
          <span className="institution-name">Global Reciprocal Colleges</span>
          <span className="system-name">Automated Enrollment System</span>
        </span>
      </Link>

      <nav className="public-navigation" aria-label="Public navigation">
        <a href="#portal-guide">Portal guide</a>
        <a href="#system-readiness">System readiness</a>
      </nav>

      <Button asChild>
        <Link to="/login">
          Sign in to portal
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </header>
  )
}
