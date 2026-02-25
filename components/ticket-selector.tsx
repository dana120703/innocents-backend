"use client"

import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"

export interface TicketSelection {
  voksne: number
  barn_4_12: number
  barn_0_3: number
  bord: number
  test: number
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
  {
    id: "test" as const,
    label: "Test",
    age: "Testbillett 1 kr",
    price: 1,
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
    <div className="flex flex-col gap-3">
      {tickets.map((ticket) => {
        const count = selection[ticket.id]
        const isActive = count > 0

        return (
          <div
            key={ticket.id}
            className={cn(
              "flex items-center justify-between rounded-xl border-2 px-4 py-4 transition-all duration-150 md:px-5",
              isActive
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground md:text-base">
                {ticket.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {ticket.age}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm font-bold tabular-nums text-foreground md:text-base">
                {ticket.price === 0 ? "Gratis" : `${ticket.price} kr`}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => updateCount(ticket.id, -1)}
                  disabled={count === 0}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    count === 0
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  )}
                  aria-label={`Reduser antall ${ticket.label}-billetter`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="flex h-8 w-8 items-center justify-center text-sm font-semibold tabular-nums text-foreground"
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
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    count === 20
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  )}
                  aria-label={`Legg til ${ticket.label}-billett`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
