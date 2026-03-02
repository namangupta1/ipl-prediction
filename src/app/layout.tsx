import type { Metadata } from 'next'
import { JetBrains_Mono, Rajdhani, Source_Sans_3 } from 'next/font/google'

import './globals.css'

const bodyFont = Source_Sans_3({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const displayFont = Rajdhani({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const monoFont = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['500', '700'],
})

export const metadata: Metadata = {
  title: 'IPL Prediction Game',
  description: 'Predict IPL match outcomes and compete with friends',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
