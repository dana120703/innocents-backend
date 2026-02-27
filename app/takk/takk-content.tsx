"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle2, ArrowLeft, Mail, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function PageHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
        <div className="relative h-10 w-10 shrink-0">
          <Image
            src="/logo.png"
            alt="Innocents"
            width={40}
            height={40}
            className="object-contain"
            unoptimized
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-foreground">
            Innocents Norge
          </span>
          <span className="text-sm text-foreground/80">En kveld for Gaza</span>
        </div>
      </div>
    </header>
  )
}

function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, "")
  if (window.location.origin.includes("localhost")) return "http://localhost:8000"
  return ""
}

type OrderStatus = "CREATED" | "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED"

interface OrderItemState {
  ticket_type_name: string
  quantity: number
}

interface OrderState {
  order_id: string
  status: OrderStatus
  amount_nok: number
  buyer_email?: string
  buyer_name?: string
  buyer_phone?: string
  total_quantity: number
  items?: OrderItemState[]
}

export function TakkContent() {
  const params = useSearchParams()
  const orderId = params.get("orderId") ?? params.get("ordre") ?? null

  const [order, setOrder] = useState<OrderState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hent ordre og synk med Vipps (backend setter kun PAID ved bekreftet betaling; kansellert → CANCELLED).
  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }

    const apiBase = getApiBase()
    const orderUrl = apiBase ? `${apiBase}/orders/${orderId}` : `/orders/${orderId}`
    const confirmUrl = apiBase ? `${apiBase}/orders/${orderId}/confirm` : `/orders/${orderId}/confirm`
    let cancelled = false
    const timeoutMs = 15000

    const fetchOrder = async (): Promise<OrderState | null> => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        const res = await fetch(orderUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (!res.ok) {
          if (res.status === 404) setError("Ordre ikke funnet.")
          else setError("Kunne ikke hente ordrestatus.")
          return null
        }
        const data = await res.json()
        if (!cancelled) {
          setOrder(data)
          setLoading(false)
        }
        if (data) {
          fetch(confirmUrl, { method: "POST" }).catch(() => {})
        }
        return data
      } catch (err) {
        if (cancelled) return null
        setError("Kunne ikke koble til server. Ordren er registrert – sjekk e-posten din for billetter.")
        setLoading(false)
        fetch(confirmUrl, { method: "POST" }).catch(() => {})
        return null
      }
    }

    fetchOrder()

    return () => {
      cancelled = true
    }
  }, [orderId])

  // Ved PENDING/CREATED: poll noen ganger slik at vi oppdaterer til PAID hvis betaling nettopp ble bekreftet
  useEffect(() => {
    if (!orderId || !order || !["PENDING", "CREATED"].includes(order.status)) return
    const apiBase = getApiBase()
    const orderUrl = apiBase ? `${apiBase}/orders/${orderId}` : `/orders/${orderId}`
    const maxPolls = 6
    let count = 0
    const interval = setInterval(async () => {
      count += 1
      if (count > maxPolls) {
        clearInterval(interval)
        return
      }
      try {
        const res = await fetch(orderUrl)
        if (!res.ok) return
        const data = await res.json()
        setOrder(data)
        if (data?.status === "PAID" || data?.status === "CANCELLED" || data?.status === "EXPIRED") {
          clearInterval(interval)
        }
      } catch {
        // ignorer
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [orderId, order?.status])

  // Ingen orderId – f.eks. direkte til /takk
  if (!orderId) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader />
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
        <PageHeader />
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

  // Kun kort lasting – backend setter PAID ved første kall, så vi viser suksess med én gang
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          <h1 className="font-serif text-xl text-foreground">Bekrefter bestilling</h1>
          <p className="text-center text-sm text-muted-foreground">
            Vi registrerer ordren og sender billettene på e-post.
          </p>
        </main>
      </div>
    )
  }

  // Venter på betaling / sjekker status (PENDING eller CREATED – bruker kansellerte eller betaling ikke bekreftet ennå)
  if (order && ["PENDING", "CREATED"].includes(order.status)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <h1 className="font-serif text-xl text-foreground">Sjekker betalingsstatus</h1>
          <p className="text-center text-sm text-muted-foreground">
            Hvis du fullførte betalingen, oppdaterer vi siden automatisk. Kansellerte du, ble du ikke belastet.
          </p>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Tilbake til billettsalg
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  // Suksess: kun ved PAID (betaling bekreftet hos Vipps)
  if (order && order.status === "PAID") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader />

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
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Bestilling</p>
                    {order.items.map((line, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {line.quantity}× {line.ticket_type_name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Antall billetter</span>
                    <span className="font-semibold text-foreground">{order.total_quantity}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Totalt betalt</span>
                  <span className="font-semibold text-foreground">
                    {order.amount_nok.toLocaleString("nb-NO")} kr
                  </span>
                </div>
              </div>
              {(order.buyer_name || order.buyer_email || order.buyer_phone) && (
                <div className="border-t border-border px-5 py-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Registrert kjøperinfo</p>
                  {order.buyer_name && (
                    <p className="text-sm text-foreground">Navn: {order.buyer_name}</p>
                  )}
                  {order.buyer_email && (
                    <p className="text-sm text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      E-post: {order.buyer_email}
                    </p>
                  )}
                  {order.buyer_phone && (
                    <p className="text-sm text-foreground">Telefon: {order.buyer_phone}</p>
                  )}
                  {order.buyer_email && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Bekreftelse sendt til {order.buyer_email}
                    </p>
                  )}
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

        <footer className="mt-auto border-t border-border bg-card/30">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-sm text-foreground/90">&copy; 2026 Innocents Norge · En kveld for Gaza</p>
            <p className="text-sm text-foreground/80">
              Nettsiden er hostet og utviklet av{" "}
              <a
                href="https://pixlmedia.no"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Pixl Media
              </a>
            </p>
          </div>
        </footer>
      </div>
    )
  }

  // Kansellert / utløpt / feil
  if (order && ["CANCELLED", "EXPIRED", "FAILED"].includes(order.status)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader />
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

  return null
}
