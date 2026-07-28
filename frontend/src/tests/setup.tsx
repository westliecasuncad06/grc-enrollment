import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, vi } from "vitest"

import {
  getPathname,
  getRouteParams,
  getSearchParams,
  resetNavigation,
  routerMock,
} from "@/tests/navigation-mock"

// Mocked once here rather than per file: every component that navigates pulls
// from `next/navigation`, and the App Router provides no in-memory router to
// wrap them in the way react-router's MemoryRouter did.
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => getPathname(),
  useSearchParams: () => getSearchParams(),
  useParams: () => getRouteParams(),
}))

// `next/link` reaches for the real router context to prefetch, which does not
// exist under jsdom. A plain anchor preserves everything the tests assert on:
// the accessible name and the `href`.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  resetNavigation()
})
