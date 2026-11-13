import type { MetadataRoute } from 'next'

// Installs Pedhi to the home screen as a full-screen app (Android, iOS 16.4+, desktop Chrome/Edge).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pedhi: AI munim for family businesses',
    short_name: 'Pedhi',
    description: 'Sales, stock, udhaar, books and a daily brief across every branch.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f3f0',
    theme_color: '#b02a20',
    lang: 'en-IN',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'New bill', url: '/bill', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Books', url: '/books', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Udhaar', url: '/customers', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
