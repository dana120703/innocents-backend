"use client"

import { useState, useEffect, type FormEvent } from "react"
import { toast } from "sonner"
import {
  TicketSelector,
  type TicketSelection,
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

export default function TicketPage() {
  const [ticketTypeIds, setTicketTypeIds] = useState<Record<string, string>>({})
  const [selection, setSelection] = useState<TicketSelection>({
    voksen: 0,
    barn: 0,
    pensjonist: 0,
    test: 0,
    gratisTest: 0,
  })
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const url = API_BASE ? `${API_BASE}/ticket-types` : "/ticket-types"
    fetch(url)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))
      )
      .then((types: { id: string; name: string }[]) => {
        const map: Record<string, string> = {}
        for (const t of types) {
          if (["Voksen", "Barn", "Pensjonist", "Test", "Gratis test"].includes(t.name)) {
            map[t.name] = t.id
          }
        }
        setTicketTypeIds(map)
      })
      .catch(() =>
        toast.error(`Kunne ikke koble til billettserver. Sjekk at backend kjører på ${url}`)
      )
  }, [])

  const totalTickets = selection.voksen + selection.barn + selection.pensjonist + selection.test + selection.gratisTest
  const totalPrice =
    selection.voksen * 350 +
    selection.barn * 150 +
    selection.pensjonist * 250 +
    selection.test * 1 +
    selection.gratisTest * 0

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setEmailError("")
    if (totalTickets === 0) {
      toast.error("Velg minst én billett")
      return
    }
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError("E-post er obligatorisk – billettene sendes hit")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Ugyldig e-postadresse")
      return
    }
    const voksenId = ticketTypeIds["Voksen"]
    const barnId = ticketTypeIds["Barn"]
    const pensjonistId = ticketTypeIds["Pensjonist"]
    const testId = ticketTypeIds["Test"]
    const gratisTestId = ticketTypeIds["Gratis test"]
    if (!voksenId || !barnId || !pensjonistId || !testId || !gratisTestId) {
      toast.error("Billettyper ikke lastet ennå. Vent litt og prøv igjen.")
      return
    }
    setIsSubmitting(true)
    try {
      const items: { ticket_type_id: string; quantity: number }[] = []
      if (selection.voksen > 0) items.push({ ticket_type_id: voksenId, quantity: selection.voksen })
      if (selection.barn > 0) items.push({ ticket_type_id: barnId, quantity: selection.barn })
      if (selection.pensjonist > 0) items.push({ ticket_type_id: pensjonistId, quantity: selection.pensjonist })
      if (selection.test > 0) items.push({ ticket_type_id: testId, quantity: selection.test })
      if (selection.gratisTest > 0) items.push({ ticket_type_id: gratisTestId, quantity: selection.gratisTest })
      const res = await fetch(`${API_BASE}/checkout/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          buyer: { email: trimmed },
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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Innocents Norge
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Sikker bestilling
          </span>
        </div>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 md:py-12">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-serif text-3xl text-foreground md:text-4xl text-balance">
            Kjøp billetter
          </h1>
          <p className="text-sm text-muted-foreground">
            Velg antall og bestill – du betaler i Vipps.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-foreground">Velg billetter</h2>
            <TicketSelector selection={selection} onChange={setSelection} />

            {totalTickets > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                <span className="text-sm">
                  {totalTickets} {totalTickets === 1 ? "billett" : "billetter"}
                </span>
                <span className="text-base font-bold tabular-nums">
                  {totalPrice.toLocaleString("nb-NO")} kr
                </span>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-foreground">
              E-post (billettene sendes hit)
            </Label>
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
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </section>

          <Button
            type="submit"
            disabled={totalTickets === 0 || isSubmitting}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
            size="lg"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Sender deg til Vipps...
              </span>
            ) : totalTickets > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <Ticket className="h-4 w-4" />
                Bestill nå
              </span>
            ) : (
              "Velg billetter for å fortsette"
            )}
          </Button>
        </form>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-6">
          <p className="text-xs text-muted-foreground">&copy; 2026 Innocents Norge</p>
        </div>
      </footer>
    </div>
  )
}
