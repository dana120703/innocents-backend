"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, XCircle, Loader2, Camera, User } from "lucide-react"
import { Button } from "@/components/ui/button"

function getApiBase(): string {
  if (typeof window === "undefined") return ""
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env.replace(/\/$/, "")
  if (window.location.origin.includes("localhost")) return "http://localhost:8000"
  return ""
}

interface VerifyResult {
  valid: boolean
  message: string
  ticket_id?: string
  ticket_type?: string
  buyer_name?: string
  status?: string
}

export function ScannerContent() {
  const [scanning, setScanning] = useState(false)
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScannedRef = useRef<string | null>(null)

  const apiBase = getApiBase()

  const verifyTicket = useCallback(
    async (token: string): Promise<VerifyResult> => {
      const url = apiBase ? `${apiBase}/tickets/verify?token=${encodeURIComponent(token)}` : `/api/tickets/verify?token=${encodeURIComponent(token)}`
      const res = await fetch(url)
      const data = await res.json()
      return data as VerifyResult
    },
    [apiBase]
  )

  const checkinTicket = useCallback(
    async (token: string): Promise<void> => {
      const url = apiBase ? `${apiBase}/tickets/checkin` : "/api/tickets/checkin"
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText)
      }
    },
    [apiBase]
  )

  const handleScan = useCallback(
    async (token: string) => {
      if (!token || token === lastScannedRef.current) return
      lastScannedRef.current = token
      setResult(null)
      setError(null)
      setLastToken(token)
      try {
        const verify = await verifyTicket(token)
        setResult(verify)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke verifisere")
        setResult({ valid: false, message: "Feil ved oppkobling" })
      }
    },
    [verifyTicket]
  )

  const handleCheckin = useCallback(async () => {
    if (!lastToken || checkingIn) return
    setCheckingIn(true)
    setError(null)
    try {
      await checkinTicket(lastToken)
      setResult((prev) =>
        prev ? { ...prev, valid: false, status: "USED", message: "✅ Innsjekket!" } : prev
      )
      lastScannedRef.current = null
      setLastToken(null)
      setTimeout(() => setResult(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Innsjekk feilet")
    } finally {
      setCheckingIn(false)
    }
  }, [lastToken, checkingIn, checkinTicket])

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scanning) return
    setError(null)
    setResult(null)
    setLastToken(null)
    lastScannedRef.current = null
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode("qr-reader")
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        () => {}
      )
      scannerRef.current = scanner
      setScanning(true)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Kunne ikke starte kamera. Sjekk at du har gitt tillatelse."
      )
    }
  }, [scanning, handleScan])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // allerede stoppet
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <header className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold">Skann billett</h1>
        <p className="text-sm text-muted-foreground">
          Hold QR-koden fra billett-e-posten eller skjermen innenfor rammen.
        </p>
      </header>

      {!apiBase && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Sett <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">NEXT_PUBLIC_API_URL</code> til backend-URL for at skanneren skal fungere.
        </div>
      )}

      <div ref={containerRef} className="relative overflow-hidden rounded-xl border border-border bg-black">
        <div id="qr-reader" className="w-full" style={{ minHeight: 280 }} />
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/90 p-6 text-muted-foreground">
            <Camera className="h-12 w-12 opacity-50" />
            <p className="text-center text-sm">Kamera er av</p>
            <Button onClick={startScanner} size="sm">
              Start kamera
            </Button>
          </div>
        )}
      </div>

      {scanning && (
        <Button variant="outline" onClick={stopScanner} className="w-full">
          Stopp kamera
        </Button>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border-2 p-4 ${
            result.valid
              ? "border-green-500 bg-green-50 dark:bg-green-950/30"
              : "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.valid ? (
              <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-8 w-8 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{result.message}</p>
              {result.ticket_type && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Billettype: {result.ticket_type}
                </p>
              )}
              {result.buyer_name && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {result.buyer_name}
                </p>
              )}
              {result.valid && result.status === "ISSUED" && (
                <Button
                  className="mt-3 w-full"
                  onClick={handleCheckin}
                  disabled={checkingIn}
                >
                  {checkingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sjekker inn…
                    </>
                  ) : (
                    "Sjekk inn"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        En kveld for Gaza – Innocents. Bruk kun for innsjekk i døra.
      </p>
    </div>
  )
}
