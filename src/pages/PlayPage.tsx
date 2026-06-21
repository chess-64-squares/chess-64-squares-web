import type { DragEvent } from 'react'
import { ChessBoard } from '../component/ChessBoard'
import { MoveTable } from '../component/MoveTable'
import { PlayerCard } from '../component/PlayerCard'
import type { Color, Game, GameMode, MatchState, Square, User } from '../types'
import { formatClock } from '../utils/uiFormat'

export function PlayPage({
  activeGame,
  gameModes,
  selectedMode,
  matchState,
  moveRows,
  myColor,
  turn,
  activeBoardSquares,
  selectedSquare,
  displayWhiteTimeMs,
  displayBlackTimeMs,
  user,
  moveCount,
  onSelectMode,
  onFindMatch,
  onCancelFindMatch,
  onRequestAction,
  onAbortGame,
  onDragStart,
  onDrop,
  onSquareClick,
}: {
  activeGame: Game | null
  gameModes: GameMode[]
  selectedMode: number | null
  matchState: MatchState
  moveRows: { number: number; white: string; black: string }[]
  myColor: Color | null
  turn: Color
  canMove: boolean
  activeBoardSquares: Square[]
  selectedSquare: string | null
  displayWhiteTimeMs: number
  displayBlackTimeMs: number
  user: User | null
  moveCount: number
  onSelectMode: (gameModeId: number) => void
  onFindMatch: () => void
  onCancelFindMatch: () => void
  onRequestAction: (type: 'draw' | 'resign') => void
  onAbortGame: () => void
  onDragStart: (square: Square, event: DragEvent<HTMLImageElement>) => void
  onDrop: (square: Square, event: DragEvent<HTMLButtonElement>) => void
  onSquareClick: (square: Square) => void
}) {
  const isModeLocked = matchState === 'waiting' || matchState === 'connecting' || matchState === 'playing'

  return (
    <section className="play-page">
      <aside className="match-panel">
        <p className="eyebrow">Matchmaking</p>
        <div className="mode-list">
          {gameModes.length === 0 && <span className="empty compact">Loading game modes...</span>}
          {gameModes.map((mode) => (
            <button disabled={isModeLocked} className={selectedMode === mode.gameModeId ? 'mode-card selected' : 'mode-card'} key={mode.gameModeId} onClick={() => onSelectMode(mode.gameModeId)} type="button">
              <strong>{mode.gameModeName}</strong>
              <span>{mode.time}+{mode.plusPerMove}</span>
            </button>
          ))}
        </div>
        <div className="match-actions">
          {matchState === 'waiting' || matchState === 'connecting' ? (
            <button className="button secondary" onClick={onCancelFindMatch}>Cancel search</button>
          ) : (
            (!activeGame || matchState === 'ended') && <button className="button primary" onClick={onFindMatch} disabled={!selectedMode}>Find opponent</button>
          )}
          {(matchState === 'waiting' || matchState === 'connecting') && <span className="loading-inline"><span /> Searching...</span>}
        </div>
      </aside>

      <section className="board-area">
        <PlayerCard label="Opponent" player={getOpponentPlayer(activeGame, user)} snapshotElo={getOpponentElo(activeGame, user)} eloChange={getOpponentEloChange(activeGame, user)} time={formatClock(getOpponentTime(activeGame, user, displayWhiteTimeMs, displayBlackTimeMs))} active={activeGame ? turn !== myColor : false} />
        <ChessBoard squares={activeBoardSquares} orientation={myColor ?? 'white'} selectedSquare={selectedSquare} onDragStart={onDragStart} onDrop={onDrop} onSquareClick={onSquareClick} />
        <PlayerCard label="You" player={getSelfPlayer(activeGame, user)} snapshotElo={getSelfElo(activeGame, user)} eloChange={getSelfEloChange(activeGame, user)} time={formatClock(getSelfTime(activeGame, user, displayWhiteTimeMs, displayBlackTimeMs))} active={activeGame ? turn === myColor : false} />
      </section>

      <aside className="moves-panel">
        <div className="board-header">
          <div className="board-actions">
            {activeGame && matchState === 'playing' && (
              <>
                <button className="button tertiary small" onClick={() => onRequestAction('draw')}>Draw</button>
                {moveCount < 3 ? (
                  <button className="button tertiary small" onClick={onAbortGame}>Abort</button>
                ) : (
                  <button className="button tertiary small danger" onClick={() => onRequestAction('resign')}>Resign</button>
                )}
              </>
            )}
          </div>
        </div>
        <p className="eyebrow">Scoresheet</p>
        <MoveTable rows={moveRows} emptyText="No moves yet." />
      </aside>
    </section>
  )
}

function getPlayerColor(game: Game | null, user: User | null): Color | null {
  if (!game || !user) return null
  if (game.playerWhite.userId === user.userId) return 'white'
  if (game.playerBlack.userId === user.userId) return 'black'
  return null
}

function getSelfPlayer(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? game.playerWhite : game.playerBlack
}

function getOpponentPlayer(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? game.playerBlack : game.playerWhite
}

function getSelfElo(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? game.playerWhiteElo : game.playerBlackElo
}

function getOpponentElo(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? game.playerBlackElo : game.playerWhiteElo
}

function getSelfEloChange(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color || game.status === 'IN_PROGRESS') return undefined
  const snapshot = color === 'white' ? game.playerWhiteElo : game.playerBlackElo
  const current = color === 'white' ? game.playerWhite.elo : game.playerBlack.elo
  return snapshot === undefined ? undefined : current - snapshot
}

function getOpponentEloChange(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color || game.status === 'IN_PROGRESS') return undefined
  const snapshot = color === 'white' ? game.playerBlackElo : game.playerWhiteElo
  const current = color === 'white' ? game.playerBlack.elo : game.playerWhite.elo
  return snapshot === undefined ? undefined : current - snapshot
}

function getSelfTime(game: Game | null, user: User | null, whiteTime: number, blackTime: number) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? whiteTime : blackTime
}

function getOpponentTime(game: Game | null, user: User | null, whiteTime: number, blackTime: number) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? blackTime : whiteTime
}
