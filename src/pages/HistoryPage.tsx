import type { ReactNode } from 'react'

export function HistoryPage({ children }: { children: ReactNode }) {
  return <section className="play-page replay-page">{children}</section>
}
