import type { ReactNode } from 'react'

export function AppDialog({
  title,
  message,
  children,
}: {
  title: string
  message?: string
  children: ReactNode
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        {message && <p>{message}</p>}
        <div className="dialog-actions">{children}</div>
      </section>
    </div>
  )
}
