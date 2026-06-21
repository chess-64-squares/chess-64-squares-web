import type { Game, GameMode, PaginatedGames } from '../types'
import { requestData } from './apiService'

export const gameService = {
  getModes(token?: string | null): Promise<GameMode[]> {
    return requestData<GameMode[]>('/game/modes', 'GET', undefined, token)
  },

  getByUser(userId: number, page: number, limit: number, token?: string | null): Promise<PaginatedGames> {
    return requestData<PaginatedGames>(`/game/user/${userId}?page=${page}&limit=${limit}`, 'GET', undefined, token)
  },

  async getByUsername(username: string, page: number, limit: number, token?: string | null): Promise<PaginatedGames> {
    const items = await requestData<Game[]>(`/game/username/${encodeURIComponent(username)}`, 'GET', undefined, token)
    const safePage = Math.max(1, page)
    const start = (safePage - 1) * limit
    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page: safePage,
      limit,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    }
  },

  getDetail(gameId: number, token?: string | null): Promise<Game> {
    return requestData<Game>(`/game/${gameId}`, 'GET', undefined, token)
  },

  getMyActiveGame(token?: string | null): Promise<Game | null> {
    return requestData<Game | null>('/game/active/me', 'GET', undefined, token)
  },
}
