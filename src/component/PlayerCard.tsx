import type { User } from '../types'

export function PlayerCard({
  label,
  player,
  snapshotElo,
  eloChange,
  active,
}: {
  label: string
  player?: User
  snapshotElo?: number
  eloChange?: number
  active: boolean
}) {
  return (
    <article className={active ? 'player-card active' : 'player-card'}>
      <span>{label}</span>
      <strong>{player?.username ?? '-'}</strong>
      <small>Elo {formatElo(snapshotElo ?? player?.elo, eloChange)}</small>
    </article>
  )
}

function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return '-'
  if (!change) return String(elo)
  return `${elo} ${change > 0 ? '+' : ''}${change}`
}
