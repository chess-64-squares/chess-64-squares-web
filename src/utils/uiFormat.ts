import type { Game, User } from '../types'

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    WAITING_FOR_OPPONENT: 'Waiting',
    IN_PROGRESS: 'In progress',
    WHITE_WINS: 'White wins',
    BLACK_WINS: 'Black wins',
    DRAW: 'Draw',
    ABORTED: 'Aborted',
    FINISHED: 'Finished',
  }
  return labels[status] ?? status
}

export function reasonLabel(reason?: string | null) {
  if (!reason) return '-'
  return reason.replaceAll('_', ' ').toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase())
}

export function formatDate(value?: string | Date) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatClock(value?: number) {
  if (value === undefined) return undefined
  const totalSeconds = Math.ceil(Math.max(0, value) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return ''
  if (!change) return String(elo)
  return `(${elo}) (${change > 0 ? '+' : ''}${change})`
}

export function getEloChange(game: Game, color: 'white' | 'black') {
  const snapshot = color === 'white' ? game.playerWhiteElo : game.playerBlackElo
  const current = color === 'white' ? game.playerWhite.elo : game.playerBlack.elo
  if (snapshot === undefined || current === undefined) return undefined
  return current - snapshot
}

export function resultTitle(game: Game, user: User | null) {
  if (game.status === 'DRAW') return 'Game drawn'
  if (!user) return 'Game over'
  const isWhite = game.playerWhite.userId === user.userId
  const didWin = (isWhite && game.status === 'WHITE_WINS') || (!isWhite && game.status === 'BLACK_WINS')
  return didWin ? 'You won' : 'You lost'
}
