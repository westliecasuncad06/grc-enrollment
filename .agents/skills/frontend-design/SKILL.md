---
name: frontend-design
description: Modern UI/UX architecture, responsive Tailwind CSS layouts, accessible components (WCAG 2.1 AA), micro-interactions, and design system integration with React, TypeScript, and shadcn/ui.
---

# Frontend Design & UI/UX Skill

This skill provides patterns, workflows, and standards for crafting accessible, high-performance, responsive, and visually polished frontend applications using React, TypeScript, Tailwind CSS, and shadcn/ui.

---

## 1. Core Principles

- **Strict Separation of Concerns**: UI rendering components must never execute raw `fetch` or direct network calls. All data fetching lives in API service modules managed via TanStack Query hooks.
- **Accessibility by Default (WCAG 2.1 AA)**: Semantic HTML tags, ARIA attributes where necessary, keyboard navigability (`Tab`, `Escape`, arrow keys), visible focus rings (`focus-visible:ring-2`), and high contrast ratios.
- **Design System Consistency**: Rely on design tokens, utility classes from Tailwind CSS, and headless/accessible primitives (Radix UI / shadcn/ui). Avoid ad-hoc inline styles.
- **Responsive & Adaptive**: Mobile-first design principles (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`). Ensure touch targets meet minimum dimensions (44x44px) on touch devices.
- **Graceful Motion & Performance**: Smooth micro-interactions that respect `prefers-reduced-motion: reduce`. Prevent layout shifts (CLS) by reserving dimensions for images and skeleton placeholders.

---

## 2. Component & Layout Architecture

### A. State Management & Asynchronous Boundaries
- Structure page components using clear loading/error boundaries:
  - **`AsyncBoundary`** or Suspense wrappers around dynamic sections to prevent layout flickers.
  - Skeletons matching exact final content geometry to avoid layout shift.
  - Dedicated empty states with actionable guidance (e.g., "No sections found. Create a new section to get started.").

### B. Form Handling with React Hook Form + Zod
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  code: z.string().min(2, "Subject code must be at least 2 characters").max(10),
  title: z.string().min(3, "Title is required"),
  units: z.coerce.number().min(1).max(6),
});

type FormValues = z.infer<typeof schema>;

export function SubjectForm({ onSubmit }: { onSubmit: (data: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", title: "", units: 3 },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject Code</FormLabel>
              <FormControl>
                <Input placeholder="IT101" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving..." : "Save Subject"}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 3. Micro-Interactions & Animation Guidelines

- **Micro-Interactions**: Hover, active, focus, and transition states should be subtle and fast ($150\text{ms} - 300\text{ms}$):
  ```tsx
  <button className="inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground active:scale-[0.98]">
    Action
  </button>
  ```
- **Motion Accessibility**: Always hook into reduced motion preferences:
  ```ts
  const prefersReducedMotion = useReducedMotion();
  // Bypass or simplify animations when true
  ```
- **Feedback & Toasts**: Provide immediate optimistic UI updates or concise toast notifications on mutation success/failure.

---

## 4. Accessibility & Responsive Checklist

1. **Color Contrast**: Normal text $\ge 4.5:1$, large text $\ge 3:1$ against backgrounds.
2. **Focus Visibility**: Ensure all interactive elements have visible `:focus-visible` styles.
3. **Screen Readers**:
   - Icon-only buttons must include `aria-label` or `sr-only` text.
   - Status messages and live alerts should use `aria-live="polite"`.
   - Modals and dialogs must trap focus and manage `aria-describedby` and `aria-labelledby`.
4. **Data Tables & Lists**:
   - Use `<table>`, `<thead>`, `<th>` with `scope="col"`, and `<tbody>` for tabular data.
   - For responsive views on mobile, stack table rows as cards (`hidden md:table-row`).

---

## 5. Verification Commands

```bash
# Typecheck
npx tsc --noEmit

# Component / Unit Testing
npx vitest run

# Linting & Formatting
npx eslint src/
npx prettier --check src/
```

