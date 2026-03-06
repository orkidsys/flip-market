'use client'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ConnectProvider } from '@stacks/connect-react'
import { StacksMainnet, StacksTestnet } from '@stacks/network'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? StacksMainnet : StacksTestnet

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConnectProvider
          network={NETWORK}
          appDetails={{
            name: 'Flip Market',
            icon: '/icon.png',
          }}
        >
          {children}
        </ConnectProvider>
      </body>
    </html>
  )
}
