import { Suspense } from "react"
import { TakkContent } from "./takk-content"

export const metadata = {
  title: "Bestilling bekreftet - Innocents Norge",
  description: "Din bestilling er bekreftet. Takk for kjopet!",
}

export default function TakkPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      }
    >
      <TakkContent />
    </Suspense>
  )
}
