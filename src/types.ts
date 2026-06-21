import type { GameStatus } from './enum/game-status.enum'
import type { ReasonForEnding } from './enum/reason-for-ending.enum'
import type { UserStatus } from './enum/user-status.enum'

export type ToastType = 'success' | 'error' | 'warning' | 'info'
export type MatchState = 'idle' | 'connecting' | 'waiting' | 'playing' | 'ended'
export type Color = 'white' | 'black'

export type User = {
  userId: number
  username: string
  email?: string
  elo: number
  status: UserStatus | string
  isEmailVerified?: boolean
  createdAt?: string | Date
}

export type GameMode = {
  gameModeId: number
  gameModeName: string
  time: number
  plusPerMove: number
}

export type Move = {
  moveNumber: number
  isWhite: boolean
  san: string
  fen: string
}

export type Game = {
  gameId: number
  playerWhite: User
  playerBlack: User
  gameMode?: GameMode
  playerWhiteElo?: number
  playerBlackElo?: number
  playerWhiteTimeMs?: number
  playerBlackTimeMs?: number
  lastMoveAt?: string | Date | null
  fen: string
  status: GameStatus | string
  reasonForEnding: ReasonForEnding | string | null
  date?: string | Date
  moves?: Move[]
}

export type PaginatedGames = {
  items: Game[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type Square = {
  name: string
  piece: string | null
}

export type PendingOffer = {
  offerId: string
  gameId: number
  type: 'draw' | 'resign'
  fromUserId: number
}
