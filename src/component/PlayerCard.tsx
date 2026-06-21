import type { User } from '../types'

export function PlayerCard({
  label,
  player,
  snapshotElo,
  time,
  active,
}: {
  label: string
  player?: User
  snapshotElo?: number
  time?: string
  active: boolean
}) {
  return (
    <article className={active ? 'player-card active' : 'player-card'}>
      <div>
        <span>{label}</span>
        <strong>{player?.username ?? '-'}</strong>
        <small>Elo {formatElo(snapshotElo ?? player?.elo)}</small>
      </div>
      <time>{time ?? '--:--'}</time>
    </article>
  )
}

function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return '-'
  if (!change) return String(elo)
  return `${elo} ${change > 0 ? '+' : ''}${change}`
}
