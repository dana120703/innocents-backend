"use client"

import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"

/** Billettype slik backend returnerer den fra GET /ticket-types. */
export interface TicketTypeOption {
  id: string
  /** Ordinær pris */
  price_nok: number
  /** Prisen som gjelder nå – kampanjepris hvis den er aktiv */
  discounted_price_nok: number
  discount_percent: number
  name: string
  capacity: number
  sold_count: number
  campaign_active: boolean
  campaign_label: string | null
  /** ISO-tidspunkt for når kampanjeprisen går ut, null hvis ingen kampanje */
  campaign_ends_at: string | null
}

/** Antall valgt per billettype-id. Nøkkel = TicketTypeOption.id (ikke navn). */
export type TicketSelection = Record<string, number>

/** Maks antall av én billettype i samme ordre. */
export const MAX_PER_TYPE = 20

/** Hvor mange som er igjen av en billettype (aldri negativt). */
export function availableOf(tt: TicketTypeOption): number {
  return Math.max(0, tt.capacity - (tt.sold_count ?? 0))
}

interface TicketSelectorProps {
  /** Billettyper fra API-et – rekkefølgen bestemmer visningsrekkefølgen. */
  ticketTypes: TicketTypeOption[]
  selection: TicketSelection
  onChange: (selection: TicketSelection) => void
}

export function TicketSelector({ ticketTypes, selection, onChange }: TicketSelectorProps) {
  const updateCount = (tt: TicketTypeOption, delta: number) => {
    const max = Math.min(MAX_PER_TYPE, availableOf(tt))
    const newVal = Math.max(0, Math.min(max, (selection[tt.id] ?? 0) + delta))
    onChange({ ...selection, [tt.id]: newVal })
  }

  if (ticketTypes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        Laster billettyper …
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {ticketTypes.map((ticket) => {
        const count = selection[ticket.id] ?? 0
        const isActive = count > 0
        const available = availableOf(ticket)
        const soldOut = available === 0
        const max = Math.min(MAX_PER_TYPE, available)
        const displayPrice = ticket.discounted_price_nok
        const isFree = displayPrice === 0
        const hasDiscount = ticket.price_nok > ticket.discounted_price_nok

        // Undertekst: bare når den sier noe nytt – utsolgt eller få igjen.
        const subtitle = soldOut
          ? "Utsolgt"
          : available <= 10
            ? `Kun ${available} igjen`
            : null

        return (
          <div
            key={ticket.id}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 md:px-5 md:py-4",
              soldOut
                ? "border-border bg-muted/20 opacity-60"
                : isActive
                  ? "border-primary/60 bg-primary/5 shadow-sm"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground md:text-base">
                {ticket.name}
              </span>
              {subtitle && (
                <span className={cn("text-xs", soldOut ? "text-destructive" : "text-muted-foreground")}>
                  {subtitle}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 md:gap-4">
              <span
                className={cn(
                  "min-w-[4rem] text-right text-sm font-bold tabular-nums md:text-base",
                  isFree ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {isFree ? (
                  "Gratis"
                ) : hasDiscount ? (
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="text-muted-foreground line-through text-xs">
                      {ticket.price_nok} kr
                    </span>
                    <span className="text-primary font-bold">{ticket.discounted_price_nok} kr</span>
                  </span>
                ) : (
                  `${displayPrice} kr`
                )}
              </span>
              <div className="flex items-center gap-0.5 rounded-lg bg-background/80 p-0.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => updateCount(ticket, -1)}
                  disabled={count === 0}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    count === 0
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                  aria-label={`Reduser antall ${ticket.name}-billetter`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="flex h-9 w-9 items-center justify-center text-sm font-semibold tabular-nums text-foreground"
                  aria-live="polite"
                  aria-label={`${count} ${ticket.name}-billetter valgt`}
                >
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(ticket, 1)}
                  disabled={count >= max}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    count >= max
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                  aria-label={`Legg til ${ticket.name}-billett`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
