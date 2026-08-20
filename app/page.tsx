"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import Image from "next/image"
import { toast } from "sonner"
import {
  TicketSelector,
  availableOf,
  type TicketSelection,
  type TicketTypeOption,
} from "@/components/ticket-selector"
import { PriceCountdown } from "@/components/price-countdown"
import { EVENT } from "@/lib/event"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, Lock, MapPin, Ticket } from "lucide-react"
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

export default function TicketPage() {
  const [ticketTypes, setTicketTypes] = useState<TicketTypeOption[]>([])
  const [selection, setSelection] = useState<TicketSelection>({})
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState("")
  const [nameError, setNameError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Billettyper, navn og priser kommer utelukkende fra backend – ingenting er hardkodet her.
  const loadTicketTypes = useCallback((keepSelection = false) => {
    const url = API_BASE ? `${API_BASE}/ticket-types` : "/ticket-types"
    return fetch(url)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))
      )
      .then((types: TicketTypeOption[]) => {
        setTicketTypes(types)
        if (!keepSelection) {
          setSelection(Object.fromEntries(types.map((t) => [t.id, 0])))
        }
      })
      .catch(() =>
        toast.error(`Kunne ikke koble til billettserver. Sjekk at backend kjører på ${url}`)
      )
  }, [])

  useEffect(() => {
    loadTicketTypes()
  }, [loadTicketTypes])

  // Når nedtellingen når null har prisen gått opp – hent nye priser så kunden
  // ikke står igjen med lanseringsprisen på skjermen.
  const handleCampaignExpired = useCallback(() => {
    loadTicketTypes(true).then(() =>
      toast.info("Lanseringsprisen er utløpt – prisen er oppdatert.")
    )
  }, [loadTicketTypes])

  const campaign = ticketTypes.find((t) => t.campaign_active && t.campaign_ends_at)
  const totalTickets = ticketTypes.reduce((sum, t) => sum + (selection[t.id] ?? 0), 0)
  const totalPrice = ticketTypes.reduce(
    (sum, t) => sum + (selection[t.id] ?? 0) * t.discounted_price_nok,
    0
  )

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
    if (ticketTypes.length === 0) {
      toast.error("Billettyper ikke lastet ennå. Vent litt og prøv igjen.")
      return
    }
    // Flere billetter valgt enn det er igjen? Backend svarer 409 – vi sier fra først.
    const oversold = ticketTypes.find((t) => (selection[t.id] ?? 0) > availableOf(t))
    if (oversold) {
      toast.error(
        `Ikke nok billetter igjen av «${oversold.name}». Tilgjengelig: ${availableOf(oversold)}`
      )
      return
    }
    setIsSubmitting(true)
    try {
      const items = ticketTypes
        .filter((t) => (selection[t.id] ?? 0) > 0)
        .map((t) => ({ ticket_type_id: t.id, quantity: selection[t.id] }))
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
                {EVENT.organizer}
              </span>
              <span className="text-xs text-muted-foreground">{EVENT.tagline}</span>
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
            {EVENT.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-foreground/80">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {EVENT.date}
            </span>
            {EVENT.time && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {EVENT.time}
              </span>
            )}
            {EVENT.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {EVENT.venue}
              </span>
            )}
          </div>

          <p className="mt-3 text-base text-muted-foreground md:text-lg">
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
          {campaign?.campaign_ends_at && (
            <PriceCountdown
              endsAt={campaign.campaign_ends_at}
              label={campaign.campaign_label ?? "Kampanjepris"}
              ordinaryPrice={campaign.price_nok}
              onExpired={handleCampaignExpired}
            />
          )}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Om Sami Hamdi
            </h2>
            <div className="flex flex-col gap-3">
              {EVENT.about.map((avsnitt, i) => (
                <p key={i} className="text-sm leading-relaxed text-foreground/90">
                  {avsnitt}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Velg antall billetter
            </h2>
            <TicketSelector
              ticketTypes={ticketTypes}
              selection={selection}
              onChange={setSelection}
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
          <p className="text-xs text-muted-foreground">
            &copy; 2026 {EVENT.organizer} · {EVENT.title}
          </p>
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
