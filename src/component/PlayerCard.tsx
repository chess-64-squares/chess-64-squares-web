import type { User } from '../types'

export function PlayerCard({
  label,
  player,
  snapshotElo,
  eloChange,
  time,
  active,
}: {
  label: string
  player?: User
  snapshotElo?: number
  eloChange?: number
  time?: string
  active: boolean
}) {
  return (
    <article className={active ? 'player-card active' : 'player-card'}>
      <div>
        <span>{label}</span>
        <strong>{player?.username ?? '-'}</strong>
        <small>Elo {formatElo(snapshotElo ?? player?.elo, eloChange)}</small>
      </div>
      <time className={active ? 'time active' : 'time'}>{time ?? '--:--'}</time>
    </article>
  )
}

function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return ''
  if (!change) return String(elo)
  return `${elo} ${change > 0 ? '+' : ''}${change}`
}
