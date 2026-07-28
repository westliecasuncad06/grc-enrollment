import type { NextConfig } from "next"

/**
 * The Presentation Layer is client-rendered only (ADR 0013). It holds no
 * server session, never server-renders authorized student data, and does not
 * proxy the Laravel API — `frontend/` and `backend/` stay independently
 * runnable per ADR 0001. There is deliberately no `rewrites()` block here.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
