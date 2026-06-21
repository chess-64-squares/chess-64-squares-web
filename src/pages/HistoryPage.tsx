import { useEffect } from 'react'
import { ChessBoard } from '../component/ChessBoard'
import { MoveTable } from '../component/MoveTable'
import { PlayerCard } from '../component/PlayerCard'
import type { Color, Game, Square, User } from '../types'
import { getEloChange, reasonLabel, statusLabel } from '../utils/uiFormat'

export function HistoryPage({
  replayGame,
  replayIndex,
  replaySquares,
  replayMoveRows,
  orientation,
  onReplayIndexChange,
}: {
  replayGame: Game | null
  replayIndex: number
  replaySquares: Square[]
  replayMoveRows: { number: number; white: string; black: string }[]
  orientation: Color
  user: User | null
  onReplayIndexChange: (index: number | ((current: number) => number)) => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!replayGame) return
      if (event.key === 'ArrowLeft') {
        onReplayIndexChange((index) => Math.max(0, index - 1))
      }
      if (event.key === 'ArrowRight') {
        onReplayIndexChange((index) => Math.min(replayGame.moves?.length ?? 0, index + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onReplayIndexChange, replayGame])

  if (!replayGame) {
    return <div className="empty">Loading game history...</div>
  }

  return (
    <section className="play-page replay-page">
      <aside className="match-panel">
        <p className="eyebrow">Replay</p>
        <h1>Game #{replayGame.gameId}</h1>
        <div className="player-stack">
          <PlayerCard label="White" player={replayGame.playerWhite} snapshotElo={replayGame.playerWhiteElo} eloChange={getEloChange(replayGame, 'white')} active={false} />
          <PlayerCard label="Black" player={replayGame.playerBlack} snapshotElo={replayGame.playerBlackElo} eloChange={getEloChange(replayGame, 'black')} active={false} />
        </div>
        <div className="panel">
          <span>{statusLabel(replayGame.status)}</span>
          <strong>{reasonLabel(replayGame.reasonForEnding)}</strong>
        </div>
      </aside>

      <section className="board-area">
        <div className="board-header">
          <div>
            <span className="badge">Move {replayIndex} / {replayGame.moves?.length ?? 0}</span>
            <h2>{replayIndex === 0 ? 'Starting position' : replayGame.moves?.[replayIndex - 1]?.san}</h2>
          </div>
          <div className="replay-controls">
            <button className="icon-button" title="First" onClick={() => onReplayIndexChange(0)}>«</button>
            <button className="icon-button" title="Previous" onClick={() => onReplayIndexChange((index) => Math.max(0, index - 1))}>‹</button>
            <button className="icon-button" title="Next" onClick={() => onReplayIndexChange((index) => Math.min(replayGame.moves?.length ?? 0, index + 1))}>›</button>
            <button className="icon-button" title="Last" onClick={() => onReplayIndexChange(replayGame.moves?.length ?? 0)}>»</button>
          </div>
        </div>
        <ChessBoard squares={replaySquares} orientation={orientation} />
      </section>

      <aside className="moves-panel">
        <p className="eyebrow">Scoresheet</p>
        <h2>Moves</h2>
        <MoveTable rows={replayMoveRows} emptyText="No moves recorded." />
      </aside>
    </section>
  )
}
