import type { ReactNode } from 'react'

export function AuthPanel({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <section className="auth-page">
      <div className="auth-copy">
        <p className="eyebrow">Chess 64 Squares</p>
        <h1>{title}</h1>
        <p>{caption}</p>
      </div>
      <div className="auth-card">{children}</div>
    </section>
  )
}
