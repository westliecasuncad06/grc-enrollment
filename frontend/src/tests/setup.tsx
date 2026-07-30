import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, expect, vi } from "vitest"
import * as axeMatchers from "vitest-axe/matchers"

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

expect.extend(axeMatchers)

// jsdom implements neither the Pointer Events capture API nor
// `scrollIntoView`. Radix's Select (and other Radix primitives using the same
// pointer-capture-based open/close handling) call these directly, so without
// a polyfill any `userEvent.click()` on a Select trigger throws.
/* eslint-disable @typescript-eslint/unbound-method -- these are plain
   arrow-function polyfills assigned to the prototype, not extracted method
   references; there is no `this` to detach. */
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false
  window.HTMLElement.prototype.setPointerCapture ??= () => undefined
  window.HTMLElement.prototype.releasePointerCapture ??= () => undefined
  window.HTMLElement.prototype.scrollIntoView ??= () => undefined
}
/* eslint-enable @typescript-eslint/unbound-method */

afterEach(() => {
  cleanup()
  resetNavigation()
})
