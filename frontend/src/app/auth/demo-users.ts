import { demoRoles, type DemoUser } from "@/app/auth/demo-auth-types"

export { demoRoles }

export const sharedDemoPassword = "GRC-Demo-Only!2026"

export const demoUsers = [
  {
    id: "demo-student",
    displayName: "Demo Student",
    email: "student.demo@grc.test",
    password: sharedDemoPassword,
    role: "student",
  },
  {
    id: "demo-admission-staff",
    displayName: "Demo Admission Staff",
    email: "admission.demo@grc.test",
    password: sharedDemoPassword,
    role: "admission_staff",
  },
  {
    id: "demo-faculty",
    displayName: "Demo Faculty",
    email: "faculty.demo@grc.test",
    password: sharedDemoPassword,
    role: "faculty",
  },
  {
    id: "demo-program-chair",
    displayName: "Demo Program Chair",
    email: "chair.demo@grc.test",
    password: sharedDemoPassword,
    role: "program_chair",
  },
  {
    id: "demo-dean",
    displayName: "Demo Dean",
    email: "dean.demo@grc.test",
    password: sharedDemoPassword,
    role: "dean",
  },
  {
    id: "demo-executive-director",
    displayName: "Demo Executive Director",
    email: "executive.demo@grc.test",
    password: sharedDemoPassword,
    role: "executive_director",
  },
  {
    id: "demo-registrar-head",
    displayName: "Demo Registrar Head",
    email: "registrar-head.demo@grc.test",
    password: sharedDemoPassword,
    role: "registrar_head",
  },
  {
    id: "demo-registrar-staff",
    displayName: "Demo Registrar Staff",
    email: "registrar-staff.demo@grc.test",
    password: sharedDemoPassword,
    role: "registrar_staff",
  },
  {
    id: "demo-accounting-staff",
    displayName: "Demo Accounting Staff",
    email: "accounting.demo@grc.test",
    password: sharedDemoPassword,
    role: "accounting_staff",
  },
] as const satisfies readonly DemoUser[]
