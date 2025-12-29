// app/legal/layout.tsx
import type { ReactNode } from 'react'
import Link from 'next/link'

export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
        <main className="min-h-screen bg-black text-white">
            <div className="max-w-3xl mx-auto px-6 py-16">
                {/* Simple breadcrumb back to home */}
                <div className="mb-8 text-sm text-white/60">
                    <Link href="/" className="hover:underline">
                        ← Back to home
                    </Link>
                </div>

                {children}

                <div className="mt-16 border-t border-white/10 pt-6 text-xs text-white/40">
                    © {new Date().getFullYear()} Auren Ventures Inc
                </div>
            </div>
        </main>
    )
}