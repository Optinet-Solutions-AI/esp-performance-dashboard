import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ESP Performance Dashboard',
  description: 'Email Service Provider deliverability analytics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
