/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || ""

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Når BACKEND_URL er satt: proxy API-kall til backend (så frontend kan bruke same origin)
  ...(backendUrl && {
    async rewrites() {
      const base = backendUrl.replace(/\/$/, "")
      return [
        { source: "/ticket-types", destination: `${base}/ticket-types` },
        { source: "/checkout/create", destination: `${base}/checkout/create` },
        { source: "/orders/:path*", destination: `${base}/orders/:path*` },
        { source: "/webhooks/:path*", destination: `${base}/webhooks/:path*` },
        { source: "/health", destination: `${base}/health` },
      ]
    },
  }),
}

export default nextConfig
