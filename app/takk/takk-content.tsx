"use client"

import { useSearchParams } from "next/navigation"
import { CheckCircle2, ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function TakkContent() {
  const params = useSearchParams()
  const orderId = params.get("ordre") ?? "---"
  const email = params.get("epost") ?? ""
  const count = params.get("antall") ?? "0"
  const total = params.get("total") ?? "0"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Brand bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Innocents Norge
          </span>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
        {/* Success icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <CheckCircle2 className="h-8 w-8 text-accent-foreground" />
        </div>

        {/* Heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-serif text-3xl text-foreground md:text-4xl">
            Takk for bestillingen!
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Din bestilling er bekreftet. Du vil motta en bekreftelse med
            billettene dine per e-post.
          </p>
        </div>

        {/* Order details card */}
        <div className="w-full max-w-sm rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ordrenummer</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {orderId}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Antall billetter</span>
              <span className="font-semibold text-foreground">{count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Totalt betalt</span>
              <span className="font-semibold text-foreground">
                {Number(total).toLocaleString("nb-NO")} kr
              </span>
            </div>
          </div>
          {email && (
            <div className="border-t border-border px-5 py-4">
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Bekreftelse sendt til{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Back link */}
        <Button variant="outline" asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            Kjop flere billetter
          </Link>
        </Button>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-6">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Innocents Norge
          </p>
        </div>
      </footer>
    </div>
  )
}
