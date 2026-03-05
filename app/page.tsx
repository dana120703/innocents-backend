"use client"

import { useState, useEffect, type FormEvent } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  TicketSelector,
  type TicketSelection,
  type PricesByLabel,
} from "@/components/ticket-selector"
import { Button } from "@/components/ui/button"
import { Lock, Ticket } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, "")
  if (window.location.origin.includes("localhost")) return "http://localhost:8000"
  return ""
}
const API_BASE = getApiBase()

type TicketTypeFromApi = {
  id: string
  name: string
  price_nok: number
  discounted_price_nok: number
  discount_percent: number
  capacity: number
  sold_count: number
}

export default function TicketPage() {
  const [ticketTypeIds, setTicketTypeIds] = useState<Record<string, string>>({})
  const [pricesByLabel, setPricesByLabel] = useState<PricesByLabel | undefined>(undefined)
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [selection, setSelection] = useState<TicketSelection>({
    voksne: 0,
    barn_4_12: 0,
    barn_0_3: 0,
    bord: 0,
  })
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState("")
  const [nameError, setNameError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const url = API_BASE ? `${API_BASE}/ticket-types` : "/ticket-types"
    fetch(url)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))
      )
      .then((types: TicketTypeFromApi[]) => {
        const map: Record<string, string> = {}
        const prices: PricesByLabel = {}
        let discount = 0
        for (const t of types) {
          if (
            [
              "Voksne (+12 år)",
              "Barn (4-12 år)",
              "Barn (0-3 år)",
              "Bestille bord (10 personer)",
            ].includes(t.name)
          ) {
            map[t.name] = t.id
            prices[t.name] = {
              original: t.price_nok,
              discounted: t.discounted_price_nok ?? t.price_nok,
            }
            if (t.discount_percent) discount = t.discount_percent
          }
        }
        setTicketTypeIds(map)
        setPricesByLabel(Object.keys(prices).length > 0 ? prices : undefined)
        setDiscountPercent(discount)
      })
      .catch(() =>
        toast.error(`Kunne ikke koble til billettserver. Sjekk at backend kjører på ${url}`)
      )
  }, [])

  const totalTickets =
    selection.voksne + selection.barn_4_12 + selection.barn_0_3 + selection.bord
  const totalPrice = pricesByLabel
    ? selection.voksne * (pricesByLabel["Voksne (+12 år)"]?.discounted ?? 249) +
      selection.barn_4_12 * (pricesByLabel["Barn (4-12 år)"]?.discounted ?? 50) +
      selection.barn_0_3 * (pricesByLabel["Barn (0-3 år)"]?.discounted ?? 0) +
      selection.bord * (pricesByLabel["Bestille bord (10 personer)"]?.discounted ?? 2241)
    : selection.voksne * 249 +
      selection.barn_4_12 * 50 +
      selection.barn_0_3 * 0 +
      selection.bord * 2241

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setEmailError("")
    setNameError("")
    setPhoneError("")
    if (totalTickets === 0) {
      toast.error("Velg minst én billett")
      return
    }
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError("E-post er obligatorisk – billett og kvittering sendes hit")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Ugyldig e-postadresse")
      return
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError("Navn er påkrevd")
      return
    }
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) {
      setPhoneError("Telefon er påkrevd")
      return
    }
    const voksneId = ticketTypeIds["Voksne (+12 år)"]
    const barn412Id = ticketTypeIds["Barn (4-12 år)"]
    const barn03Id = ticketTypeIds["Barn (0-3 år)"]
    const bordId = ticketTypeIds["Bestille bord (10 personer)"]
    if (!voksneId || !barn412Id || !barn03Id || !bordId) {
      toast.error("Billettyper ikke lastet ennå. Vent litt og prøv igjen.")
      return
    }
    setIsSubmitting(true)
    try {
      const items: { ticket_type_id: string; quantity: number }[] = []
      if (selection.voksne > 0) items.push({ ticket_type_id: voksneId, quantity: selection.voksne })
      if (selection.barn_4_12 > 0) items.push({ ticket_type_id: barn412Id, quantity: selection.barn_4_12 })
      if (selection.barn_0_3 > 0) items.push({ ticket_type_id: barn03Id, quantity: selection.barn_0_3 })
      if (selection.bord > 0) items.push({ ticket_type_id: bordId, quantity: selection.bord })
      const res = await fetch(`${API_BASE}/checkout/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          buyer: {
            email: trimmed,
            name: trimmedName,
            phone: trimmedPhone,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText || "Checkout feilet")
      }
      const data = await res.json() as { order_id: string; checkout_url: string }
      window.location.href = data.checkout_url
    } catch (e) {
      setIsSubmitting(false)
      toast.error(e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header – enkel og rolig */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
              <Image
                src="/logo.png"
                alt="Innocents"
                width={44}
                height={44}
                className="object-contain p-0.5"
                unoptimized
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Innocents Norge
              </span>
              <span className="text-xs text-muted-foreground">En kveld for Gaza</span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Sikker betaling
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-12 pt-6 md:pt-10">
        {/* Hero – tydelig hendelse og verdi */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            En kveld for Gaza
          </h1>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            Velg billetter under. Du betaler sikkert med Vipps eller kort og får billettene på e-post.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">✓ Vipps</span>
            <span className="flex items-center gap-1.5">✓ Billetter på e-post</span>
            <span className="flex items-center gap-1.5">✓ Rask bestilling</span>
          </div>
        </div>

        {/* Skjema i kort for fokus */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {discountPercent > 0 && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-primary">
                🎉 {discountPercent} % rabatt på alle billetter – tidsbegrenset tilbud
              </p>
            </div>
          )}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Velg antall billetter
            </h2>
            <TicketSelector
              selection={selection}
              onChange={setSelection}
              pricesByLabel={pricesByLabel}
            />

            {totalTickets > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary px-4 py-3.5 text-primary-foreground shadow-md">
                <span className="text-sm font-medium">
                  {totalTickets} {totalTickets === 1 ? "billett" : "billetter"}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {totalPrice.toLocaleString("nb-NO")} kr
                </span>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Dine opplysninger
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email" className="text-foreground">
                  E-post
                </Label>
                <p className="mb-1.5 text-xs text-muted-foreground">Billett og kvittering sendes hit</p>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@epost.no"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setEmailError("")
                  }}
                  className={emailError ? "border-destructive" : ""}
                  autoComplete="email"
                />
                {emailError && (
                  <p className="mt-1 text-sm text-destructive">{emailError}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-foreground">
                    Navn <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Fornavn og etternavn"
                    value={name}
                    required
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError("")
                    }}
                    autoComplete="name"
                    className={`mt-1.5 ${nameError ? "border-destructive" : ""}`}
                  />
                  {nameError && (
                    <p className="mt-1 text-sm text-destructive">{nameError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone" className="text-foreground">
                    Telefon <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+47 xxx xx xxx"
                    value={phone}
                    required
                    onChange={(e) => {
                      setPhone(e.target.value)
                      setPhoneError("")
                    }}
                    autoComplete="tel"
                    className={`mt-1.5 ${phoneError ? "border-destructive" : ""}`}
                  />
                  {phoneError && (
                    <p className="mt-1 text-sm text-destructive">{phoneError}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* CTA – tydelig og innbydende */}
          <Button
            type="submit"
            disabled={totalTickets === 0 || isSubmitting}
            className="h-14 w-full rounded-xl text-base font-semibold shadow-lg transition hover:shadow-xl disabled:opacity-50"
            size="lg"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Sender deg til Vipps...
              </span>
            ) : totalTickets > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <Ticket className="h-5 w-5" />
                Gå til betaling med Vipps & kort
              </span>
            ) : (
              "Velg antall billetter over"
            )}
          </Button>
        </form>
      </main>

      <footer className="mt-12 border-t border-border/60 bg-card/40 py-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs text-muted-foreground">&copy; 2026 Innocents Norge · En kveld for Gaza</p>
          <p className="text-xs text-muted-foreground">
            Nettsiden er hostet og utviklet av{" "}
            <a
              href="https://pixlmedia.no"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Pixl Media
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
