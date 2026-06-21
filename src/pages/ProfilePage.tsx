import type { Game, PaginatedGames, User } from '../types'
import { formatDate, formatElo, getEloChange, reasonLabel, statusLabel } from '../utils/uiFormat'

export function ProfilePage({
  user,
  gamesPage,
  historyLimit,
  onChangeLimit,
  onLoadGames,
  onOpenReplay,
}: {
  user: User | null
  gamesPage: PaginatedGames
  historyLimit: number
  onChangeLimit: (limit: number) => void
  onLoadGames: (page: number, limit: number) => void
  onOpenReplay: (gameId: number) => void
}) {
  return (
    <section className="profile-page">
      <div className="page-heading">
        <p className="eyebrow">Profile</p>
        <h1>{user?.username ?? 'Player'}</h1>
      </div>
      <div className="profile-grid">
        <article className="panel dark">
          <span className="metric-label">Current Elo</span>
          <strong className="metric">{user?.elo ?? 800}</strong>
          <span>{user?.isEmailVerified ? 'Email verified' : 'Email not verified'}</span>
        </article>
        <article className="panel">
          <span className="metric-label">Status</span>
          <strong>{user?.status ?? 'ACTIVE'}</strong>
          <span>Joined {formatDate(user?.createdAt)}</span>
        </article>
      </div>

      <section className="history-section">
        <div className="section-title">
          <h2>Game History</h2>
          <div className="history-tools">
            <select
              value={historyLimit}
              onChange={(event) => onChangeLimit(Number(event.target.value))}
            >
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <div className="game-list">
          {gamesPage.items.length === 0 && <div className="empty">No games recorded yet.</div>}
          {gamesPage.items.map((game) => (
            <GameRow game={game} key={game.gameId} onOpenReplay={onOpenReplay} />
          ))}
        </div>
        <div className="pagination">
          <button className="icon-button" title="First page" disabled={gamesPage.page <= 1} onClick={() => onLoadGames(1, historyLimit)}>«</button>
          <button className="icon-button" title="Previous page" disabled={gamesPage.page <= 1} onClick={() => onLoadGames(gamesPage.page - 1, historyLimit)}>‹</button>
          <span>Page {gamesPage.page} of {gamesPage.totalPages}</span>
          <button className="icon-button" title="Next page" disabled={gamesPage.page >= gamesPage.totalPages} onClick={() => onLoadGames(gamesPage.page + 1, historyLimit)}>›</button>
          <button className="icon-button" title="Last page" disabled={gamesPage.page >= gamesPage.totalPages} onClick={() => onLoadGames(gamesPage.totalPages, historyLimit)}>»</button>
        </div>
      </section>
    </section>
  )
}

function GameRow({ game, onOpenReplay }: { game: Game; onOpenReplay: (gameId: number) => void }) {
  return (
    <article className="game-row">
      <div>
        <strong>#{game.gameId}</strong>
        <span className="player-color-line"><ColorSwatch color="white" /> {game.playerWhite.username} {formatElo(game.playerWhiteElo ?? game.playerWhite.elo, getEloChange(game, 'white'))}</span>
        <span className="player-color-line"><ColorSwatch color="black" /> {game.playerBlack.username} {formatElo(game.playerBlackElo ?? game.playerBlack.elo, getEloChange(game, 'black'))}</span>
      </div>
      <span>{statusLabel(game.status)}</span>
      <span>{reasonLabel(game.reasonForEnding)}</span>
      <span>{formatDate(game.date)}</span>
      <button className="button tertiary small" onClick={() => onOpenReplay(game.gameId)}>Detail</button>
    </article>
  )
}

function ColorSwatch({ color }: { color: 'white' | 'black' }) {
  return <span className={`color-swatch ${color}`} aria-label={color} />
}
