import type { Game, GameMode, PaginatedGames } from '../types'
import { requestData } from './apiService'

export const gameService = {
  getModes(token?: string | null): Promise<GameMode[]> {
    return requestData<GameMode[]>('/game/modes', 'GET', undefined, token)
  },

  getByUser(userId: number, page: number, limit: number, token?: string | null): Promise<PaginatedGames> {
    return requestData<PaginatedGames>(`/game/user/${userId}?page=${page}&limit=${limit}`, 'GET', undefined, token)
  },

  getDetail(gameId: number, token?: string | null): Promise<Game> {
    return requestData<Game>(`/game/${gameId}`, 'GET', undefined, token)
  },

  getMyActiveGame(token?: string | null): Promise<Game | null> {
    return requestData<Game | null>('/game/active/me', 'GET', undefined, token)
  },
}
