"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface PriceCountdownProps {
  /** ISO-tidspunkt fra API-et (campaign_ends_at) – når kampanjeprisen slutter å gjelde. */
  endsAt: string
  /** Navnet på kampanjen, f.eks. «Lanseringspris». */
  label: string
  /** Ordinær pris som gjelder etter at kampanjen er over. */
  ordinaryPrice: number
  /** Kalles når nedtellingen når null, slik at siden kan hente oppdaterte priser. */
  onExpired?: () => void
}

function remainingParts(msLeft: number) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000))
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

export function PriceCountdown({ endsAt, label, ordinaryPrice, onExpired }: PriceCountdownProps) {
  const target = new Date(endsAt).getTime()
  // null frem til første tikk – da er server- og klient-HTML like og hydreringen matcher.
  const [msLeft, setMsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (Number.isNaN(target)) return

    const tick = () => {
      const left = target - Date.now()
      setMsLeft(left)
      if (left <= 0) onExpired?.()
      return left
    }

    if (tick() <= 0) return
    const interval = setInterval(() => {
      if (tick() <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
    // onExpired er stabil hos den som bruker komponenten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (Number.isNaN(target) || msLeft === null || msLeft <= 0) return null

  const { days, hours, minutes, seconds } = remainingParts(msLeft)
  const boxes = [
    { value: days, unit: days === 1 ? "dag" : "dager" },
    { value: hours, unit: "timer" },
    { value: minutes, unit: "min" },
    { value: seconds, unit: "sek" },
  ]

  const endDate = new Date(target).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  })

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-4 text-center">
      <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary">
        <Clock className="h-3.5 w-3.5" />
        {label} – prisen går opp til {ordinaryPrice} kr {endDate}
      </p>

      <div className="mt-3 flex items-center justify-center gap-2">
        {boxes.map((box) => (
          <div
            key={box.unit}
            className="flex min-w-[3.25rem] flex-col items-center rounded-lg bg-background/80 px-2 py-1.5 shadow-sm"
          >
            <span className="text-lg font-bold tabular-nums text-foreground">
              {String(box.value).padStart(2, "0")}
            </span>
            <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {box.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
