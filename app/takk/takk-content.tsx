"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckCircle2, ArrowLeft, Mail, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, "")
  if (window.location.origin.includes("localhost")) return "http://localhost:8000"
  return ""
}

type OrderStatus = "CREATED" | "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED"

interface OrderState {
  order_id: string
  status: OrderStatus
  amount_nok: number
  buyer_email?: string
  total_quantity: number
}

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 120 // 4 min

export function TakkContent() {
  const params = useSearchParams()
  const orderId = params.get("orderId") ?? params.get("ordre") ?? null

  const [order, setOrder] = useState<OrderState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    const apiBase = getApiBase()
    const url = apiBase ? `${apiBase}/orders/${orderId}` : `/orders/${orderId}`
    let cancelled = false
    let attempts = 0

    const fetchOrder = async (): Promise<OrderState | null> => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          if (res.status === 404) setError("Ordre ikke funnet.")
          else setError("Kunne ikke hente ordrestatus.")
          return null
        }
        const data = await res.json()
        setOrder(data)
        return data
      } catch {
        setError("Kunne ikke koble til server.")
        return null
      }
    }

    const poll = async () => {
      const data = await fetchOrder()
      if (cancelled || !data) return
      const done = !["PENDING", "CREATED"].includes(data.status)
      if (!done && attempts < POLL_MAX_ATTEMPTS) {
        attempts += 1
        setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    fetchOrder().then((data) => {
      setLoading(false)
      if (cancelled || !data) return
      if (data.status === "PENDING" || data.status === "CREATED") {
        setTimeout(poll, POLL_INTERVAL_MS)
      }
    })

    return () => {
      cancelled = true
    }
  }, [orderId])

  // Ingen orderId – f.eks. direkte til /takk
  if (!orderId) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Innocents Norge
            </span>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <p className="text-muted-foreground">Ingen ordre å vise.</p>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tilbake til billettsiden
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Innocents Norge
            </span>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tilbake til billettsiden
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  // Venter på betaling (polling oppdaterer order)
  if (loading || (order?.status === "PENDING" || order?.status === "CREATED")) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Innocents Norge
            </span>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <h1 className="font-serif text-xl text-foreground">Venter på betaling</h1>
          <p className="text-center text-sm text-muted-foreground">
            Fullfør betalingen i Vipps. Denne siden oppdateres automatisk.
          </p>
          <p className="font-mono text-xs text-muted-foreground">Ordre: {orderId}</p>
        </main>
      </div>
    )
  }

  // Kansellert / utløpt / feil
  if (order && ["CANCELLED", "EXPIRED", "FAILED"].includes(order.status)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Innocents Norge
            </span>
          </div>
        </div>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-serif text-xl text-foreground">Betalingen ble ikke fullført</h1>
          <p className="text-center text-sm text-muted-foreground">
            Ordren ble kansellert eller utløpt. Du ble ikke belastet.
          </p>
          <Button asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Prøv på nytt
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  // PAID – suksess
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Innocents Norge
          </span>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <CheckCircle2 className="h-8 w-8 text-accent-foreground" />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-serif text-3xl text-foreground md:text-4xl">
            Takk for bestillingen!
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Din bestilling er bekreftet. Du vil motta billettene per e-post.
          </p>
        </div>

        {order && (
          <div className="w-full max-w-sm rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ordrenummer</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {order.order_id}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Antall billetter</span>
                <span className="font-semibold text-foreground">{order.total_quantity}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Totalt betalt</span>
                <span className="font-semibold text-foreground">
                  {order.amount_nok.toLocaleString("nb-NO")} kr
                </span>
              </div>
            </div>
            {order.buyer_email && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Bekreftelse sendt til{" "}
                    <span className="font-medium text-foreground">{order.buyer_email}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <Button variant="outline" asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            Kjøp flere billetter
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
