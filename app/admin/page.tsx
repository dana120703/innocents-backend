"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Lock, LogOut, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EVENT } from "@/lib/event"

function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, "")
  if (window.location.origin.includes("localhost")) return "http://localhost:8000"
  return ""
}

/** Tokenen ligger i sessionStorage – den forsvinner når fanen lukkes. */
const TOKEN_KEY = "innocents_admin_token"

interface AdminOrder {
  order_id: string
  created_at: string
  status: string
  buyer_name: string | null
  buyer_email: string | null
  buyer_phone: string | null
  amount_nok: number
  ticket_count: number
  checked_in_count: number
  items: string
  ticket_email_sent_at: string | null
}

const STATUS_STIL: Record<string, string> = {
  PAID: "bg-accent text-accent-foreground",
  PENDING: "bg-muted text-muted-foreground",
  CREATED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-destructive/10 text-destructive",
  FAILED: "bg-destructive/10 text-destructive",
}

const STATUS_TEKST: Record<string, string> = {
  PAID: "Betalt",
  PENDING: "Venter",
  CREATED: "Påbegynt",
  CANCELLED: "Kansellert",
  EXPIRED: "Utløpt",
  FAILED: "Feilet",
}

function formatDato(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loggingIn, setLoggingIn] = useState(false)

  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setToken(sessionStorage.getItem(TOKEN_KEY))
  }, [])

  const loggUt = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setOrders(null)
    setPassword("")
  }, [])

  const hentOrdrer = useCallback(
    async (aktivToken: string) => {
      setLoading(true)
      setLoadError("")
      try {
        const res = await fetch(`${getApiBase()}/admin/orders`, {
          headers: { Authorization: `Bearer ${aktivToken}` },
        })
        if (res.status === 401) {
          loggUt()
          setLoginError("Økten er utløpt. Logg inn på nytt.")
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setOrders(await res.json())
      } catch {
        setLoadError("Kunne ikke hente bestillinger. Sjekk at backend kjører.")
      } finally {
        setLoading(false)
      }
    },
    [loggUt]
  )

  useEffect(() => {
    if (token) hentOrdrer(token)
  }, [token, hentOrdrer])

  const loggInn = async (ev: FormEvent) => {
    ev.preventDefault()
    setLoginError("")
    setLoggingIn(true)
    try {
      const res = await fetch(`${getApiBase()}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || "Feil brukernavn eller passord")
      }
      const data = (await res.json()) as { token: string }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setPassword("")
      setToken(data.token)
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Innlogging feilet")
    } finally {
      setLoggingIn(false)
    }
  }

  // ─── Innlogging ───────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <form
          onSubmit={loggInn}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <h1 className="font-serif text-xl text-foreground">Admin</h1>
            <p className="text-xs text-muted-foreground">{EVENT.title}</p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="username">Brukernavn</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <Button type="submit" disabled={loggingIn || !password} className="h-11 w-full">
              {loggingIn ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logger inn …
                </span>
              ) : (
                "Logg inn"
              )}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // ─── Oversikt ─────────────────────────────────────────────────────────────
  const betalte = orders?.filter((o) => o.status === "PAID") ?? []

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Bestillinger
            </h1>
            <p className="text-xs text-muted-foreground">{EVENT.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => hentOrdrer(token)}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Oppdater
            </Button>
            <Button variant="ghost" size="sm" onClick={loggUt} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loadError && (
          <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </p>
        )}

        {orders === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Laster …</p>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Ingen bestillinger ennå.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              {orders.length} bestillinger, hvorav {betalte.length} betalt ·{" "}
              {betalte.reduce((sum, o) => sum + o.ticket_count, 0)} billetter solgt
            </p>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Navn</th>
                    <th className="px-4 py-3 font-semibold">E-post</th>
                    <th className="px-4 py-3 font-semibold">Telefon</th>
                    <th className="px-4 py-3 font-semibold">Bestilling</th>
                    <th className="px-4 py-3 text-right font-semibold">Beløp</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Dato</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.order_id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {o.buyer_name || "–"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.buyer_email ? (
                          <a href={`mailto:${o.buyer_email}`} className="hover:underline">
                            {o.buyer_email}
                          </a>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.buyer_phone || "–"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.items || `${o.ticket_count} billetter`}
                        {o.checked_in_count > 0 && (
                          <span className="ml-1.5 text-xs text-foreground/70">
                            ({o.checked_in_count} innsjekket)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                        {o.amount_nok.toLocaleString("nb-NO")} kr
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STIL[o.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_TEKST[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDato(o.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
