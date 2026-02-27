"use client"

import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"

export interface TicketSelection {
  voksne: number
  barn_4_12: number
  barn_0_3: number
  bord: number
}

const tickets = [
  {
    id: "voksne" as const,
    label: "Voksne (+12 år)",
    age: "Voksen",
    price: 249,
  },
  {
    id: "barn_4_12" as const,
    label: "Barn (4-12 år)",
    age: "Barn",
    price: 50,
  },
  {
    id: "barn_0_3" as const,
    label: "Barn (0-3 år)",
    age: "Gratis",
    price: 0,
  },
  {
    id: "bord" as const,
    label: "Bestille bord (10 personer)",
    age: "Bord for 10",
    price: 2241,
  },
]

interface TicketSelectorProps {
  selection: TicketSelection
  onChange: (selection: TicketSelection) => void
}

export function TicketSelector({ selection, onChange }: TicketSelectorProps) {
  const updateCount = (id: keyof TicketSelection, delta: number) => {
    const newVal = Math.max(0, Math.min(20, selection[id] + delta))
    onChange({ ...selection, [id]: newVal })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tickets.map((ticket) => {
        const count = selection[ticket.id]
        const isActive = count > 0
        const isFree = ticket.price === 0

        return (
          <div
            key={ticket.id}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 md:px-5 md:py-4",
              isActive
                ? "border-primary/60 bg-primary/5 shadow-sm"
                : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground md:text-base">
                {ticket.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {ticket.age}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3 md:gap-4">
              <span
                className={cn(
                  "min-w-[4rem] text-right text-sm font-bold tabular-nums md:text-base",
                  isFree ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {isFree ? "Gratis" : `${ticket.price} kr`}
              </span>
              <div className="flex items-center gap-0.5 rounded-lg bg-background/80 p-0.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => updateCount(ticket.id, -1)}
                  disabled={count === 0}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    count === 0
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                  aria-label={`Reduser antall ${ticket.label}-billetter`}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span
                  className="flex h-9 w-9 items-center justify-center text-sm font-semibold tabular-nums text-foreground"
                  aria-live="polite"
                  aria-label={`${count} ${ticket.label}-billetter valgt`}
                >
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(ticket.id, 1)}
                  disabled={count === 20}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    count === 20
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                  aria-label={`Legg til ${ticket.label}-billett`}
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
