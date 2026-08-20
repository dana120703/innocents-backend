import type { Metadata } from "next"

// Admin-siden viser personopplysninger og skal aldri havne i søkemotorer.
export const metadata: Metadata = {
  title: "Admin – Innocents Norge",
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
