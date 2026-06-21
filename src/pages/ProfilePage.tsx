import type { ReactNode } from 'react'

export function ProfilePage({ children }: { children: ReactNode }) {
  return <section className="profile-page">{children}</section>
}
