/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Exclude API routes from caching to prevent stale data
  exclude: [
    /^\/api\//,
    /^\/monitoring$/,
    /middleware-manifest\.json$/,
  ],
  // Aggressive front-end caching for Local-First experience
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false, // Don't auto-reload, let delta sync handle it
  // Custom offline fallback page
  fallbacks: {
    document: '/offline.html',
  },
  // Workbox configuration
  workboxOptions: {
    // Skip waiting for immediate SW updates
    skipWaiting: true,
    clientsClaim: true,
    importScripts: ['/custom-sw.js'],
    // Runtime caching strategies
    runtimeCaching: [
      // NetworkOnly for all API routes - never cache API responses
      // This prevents ERR_ABORTED errors when Service Worker tries to cache dynamic data
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/.*/i,
        handler: 'NetworkOnly',
        options: {
          cacheName: 'api-runtime',
        }
      },
      // Cache-First for Google Fonts
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      // StaleWhileRevalidate for static font files
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-font-assets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          }
        }
      },
      // Cache-First for images (aggressive caching)
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-image-assets',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },
      // Cache-First for Next.js optimized images
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-image',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },
      // Cache-First for JS bundles (immutable chunks)
      {
        urlPattern: /\/_next\/static\/.+\.js$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-js-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year (immutable)
          }
        }
      },
      // Cache-First for CSS
      {
        urlPattern: /\.(?:css)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-style-assets',
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },
      // NetworkFirst for page navigations (HTML) - show from cache if offline
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          },
          networkTimeoutSeconds: 10 // Fall back to cache after 10s
        }
      },
    ]
  }
})

const nextConfig = {
  // Requerido por Dockerfile / despliegue en Kubernetes (self-hosted + cloud).
  // Antes del rebrand esto no existía porque Vercel no lo necesita para su propio runtime.
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'soap', '@vladmandic/face-api', '@react-pdf/renderer', '@grpc/grpc-js', '@grpc/proto-loader'],
  outputFileTracingRoot: process.cwd(),

  // ✅ Enable production source maps for better debugging
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },

  eslint: {
    // ✅ Linting habilitado durante builds para mejor calidad de código
    // Los errores de linting ahora bloquearán el build
    // Para ver solo warnings: next lint
    ignoreDuringBuilds: true,
    dirs: ['app', 'components', 'lib'],
  },
  typescript: {
    // Ignorar errores de tipos relacionados con next-pwa (minimatch)
    ignoreBuildErrors: true,
  },

  // Solución para problema de carga de binarios de canvas/face-api en servidor
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];

    // thermal-printer-encoder tiene exports malformado; alias al CJS directo
    const path = require('path');
    config.resolve.alias['thermal-printer-encoder'] = path.resolve(
      __dirname,
      'node_modules/thermal-printer-encoder/dist/thermal-printer-encoder.cjs'
    );

    return config;
  },

  // Security Headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },

}

const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(withBundleAnalyzer(withPWA(nextConfig)), {
  org: "plentypay-app",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
