/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
    'fuse.js',
    'react-markdown',
  ],
  // Allowed hosts for `next/image`. Without this, next/image refuses to
  // load any non-relative src and the host throws an
  // "Invalid src prop ... hostname X is not configured" error at runtime.
  // - localhost / 127.0.0.1: local Django serving /media/ uploads
  // - *.amazonaws.com: S3 buckets (staging + prod)
  // - *.cloudfront.net: CDN-served versions of the same assets
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
  },
  // Proxy /media/ and /q/ requests to Django backend
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
    return [
      {
        source: '/media/:path*',
        destination: `${apiBase}/media/:path*`,
      },
    ]
  },
  // Add cache headers for CloudFront caching
  async headers() {
    return [
      {
        // CRITICAL: Next.js static files must be cached properly
        // This ensures JS chunks are served with correct MIME type
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // Cache static assets for 1 year (immutable)
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Apply to all invitation pages (public, cacheable)
        source: '/invite/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            // Keep the CDN HTML fresh: 60s edge cache so a just-published change
            // is reflected within a minute even before client-side refresh.
            // stale-while-revalidate keeps responses fast during regeneration.
            value: 'public, s-maxage=60, stale-while-revalidate=300, max-age=0',
          },
        ],
      },
      {
        // Apply to protected host routes (no cache, always fresh)
        source: '/host/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // No caching for protected routes - always fetch fresh
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    
    // Fix axios bundling issue - externalize axios for server-side
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'axios': 'commonjs axios',
      })
    }
    
    return config
  },
}

module.exports = nextConfig

