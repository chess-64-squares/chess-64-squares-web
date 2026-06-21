import type { User } from '../types'

export function PlayerCard({
  player,
  time,
  active,
}: {
  player?: User
  time?: string
  active: boolean
}) {
  return (
    <article className={'player-card'}>
      <div>
        <strong>{player?.username || 'Opponent'} {player ? `(${formatElo(player.elo)})` : ''}</strong>
      </div>
      {time && <time className={active ? 'time active' : 'time'}>{time}</time>}
    </article>
  )
}

function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return ''
  if (!change) return String(elo)
  return `${elo} ${change > 0 ? '+' : ''}${change}`
}
