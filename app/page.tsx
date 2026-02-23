"use client"

import { useState, useCallback, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  TicketSelector,
  type TicketSelection,
} from "@/components/ticket-selector"
import { CheckoutForm, type FormData } from "@/components/checkout-form"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Lock, Ticket } from "lucide-react"

const initialFormData: FormData = {
  fornavn: "",
  etternavn: "",
  epost: "",
  adresse: "",
  postnummer: "",
  sted: "",
}

export default function TicketPage() {
  const router = useRouter()
  const [selection, setSelection] = useState<TicketSelection>({
    voksen: 0,
    barn: 0,
    pensjonist: 0,
  })
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalTickets =
    selection.voksen + selection.barn + selection.pensjonist
  const totalPrice =
    selection.voksen * 350 +
    selection.barn * 150 +
    selection.pensjonist * 250

  const validate = useCallback((): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {}
    if (!formData.fornavn.trim()) e.fornavn = "Fornavn er obligatorisk"
    if (!formData.etternavn.trim()) e.etternavn = "Etternavn er obligatorisk"
    if (!formData.epost.trim()) {
      e.epost = "E-post er obligatorisk"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.epost)) {
      e.epost = "Ugyldig e-postadresse"
    }
    if (!formData.adresse.trim()) e.adresse = "Adresse er obligatorisk"
    if (!formData.postnummer.trim()) {
      e.postnummer = "Postnummer er obligatorisk"
    } else if (!/^\d{4}$/.test(formData.postnummer)) {
      e.postnummer = "Ugyldig postnummer"
    }
    if (!formData.sted.trim()) e.sted = "Sted er obligatorisk"
    setErrors(e)
    return Object.keys(e).length === 0
  }, [formData])

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (totalTickets === 0) {
      toast.error("Velg minst en billett for a fortsette")
      return
    }
    if (!validate()) {
      toast.error("Vennligst fyll ut alle obligatoriske felt")
      return
    }
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 1400))
    const orderId = `IN-${Date.now().toString(36).toUpperCase()}`
    router.push(
      `/takk?ordre=${orderId}&epost=${encodeURIComponent(formData.epost)}&antall=${totalTickets}&total=${totalPrice}`
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Compact brand bar */}
      <div className="border-b border-border bg-card">
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
        {/* Headline */}
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-serif text-3xl text-foreground md:text-4xl text-balance">
            Kjop billetter
          </h1>
          <p className="text-sm text-muted-foreground">
            Velg antall, fyll ut skjemaet og fulfor bestillingen.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-8"
        >
          {/* Step 1 - Tickets */}
          <section className="flex flex-col gap-4">
            <StepLabel step={1} label="Velg billetter" />
            <TicketSelector selection={selection} onChange={setSelection} />

            {totalTickets > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-foreground px-4 py-3 text-primary-foreground">
                <span className="text-sm">
                  {totalTickets}{" "}
                  {totalTickets === 1 ? "billett" : "billetter"}
                </span>
                <span className="text-base font-bold tabular-nums">
                  {totalPrice.toLocaleString("nb-NO")} kr
                </span>
              </div>
            )}
          </section>

          <Separator />

          {/* Step 2 - Details */}
          <section className="flex flex-col gap-4">
            <StepLabel step={2} label="Dine opplysninger" />
            <p className="text-xs text-muted-foreground -mt-1">
              Billettene sendes til e-postadressen du oppgir.
            </p>
            <CheckoutForm
              formData={formData}
              onChange={setFormData}
              errors={errors}
            />
          </section>

          <Separator />

          {/* Step 3 - Submit */}
          <section className="flex flex-col gap-3">
            <StepLabel step={3} label="Fulfor bestillingen" />

            <Button
              type="submit"
              disabled={totalTickets === 0 || isSubmitting}
              className="h-12 w-full bg-foreground text-base font-semibold text-primary-foreground hover:bg-foreground/90 disabled:opacity-40"
              size="lg"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Behandler...
                </span>
              ) : totalTickets > 0 ? (
                <span className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  Betal {totalPrice.toLocaleString("nb-NO")} kr
                </span>
              ) : (
                "Velg billetter for a fortsette"
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Gratis avbestilling inntil 48 timer for arrangementet.
            </p>
          </section>
        </form>
      </main>

      {/* Minimal footer */}
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

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-primary-foreground">
        {step}
      </span>
      <h2 className="text-base font-semibold text-foreground">{label}</h2>
    </div>
  )
}
