import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'
import { ChessBoard } from './component/ChessBoard'
import { MoveTable } from './component/MoveTable'
import { PlayerCard } from './component/PlayerCard'
import { TOKEN_STORAGE_KEY } from './connect/connect'
import { authService } from './service/authService'
import { gameService } from './service/gameService'
import { userService } from './service/userService'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import type { Color, Game, GameMode, MatchState, Page, PaginatedGames, PendingOffer, Square, ToastType, User } from './types'

const SOCKET_BASE = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:8000/game'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''
}

function parseFen(fen: string): Square[] {
  const [placement] = fen.split(' ')
  const rows = placement.split('/')
  const squares: Square[] = []

  rows.forEach((row, rankIndex) => {
    let fileIndex = 0
    for (const char of row) {
      const empty = Number(char)
      if (Number.isInteger(empty) && empty > 0) {
        for (let i = 0; i < empty; i += 1) {
          squares.push({ name: `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`, piece: null })
          fileIndex += 1
        }
      } else {
        squares.push({ name: `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`, piece: char })
        fileIndex += 1
      }
    }
  })

  return squares
}

function statusLabel(status: string) {
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

function reasonLabel(reason?: string | null) {
  if (!reason) return '-'
  return reason.replaceAll('_', ' ').toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase())
}

function App() {
  const initialPage = window.location.pathname === '/verify-email' ? 'verify-email' : getStoredToken() ? 'play' : 'login'
  const initialVerifyToken = initialPage === 'verify-email' ? new URLSearchParams(window.location.search).get('token') : null
  const [page, setPage] = useState<Page>(initialPage)
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState<User | null>(null)
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [verifyState, setVerifyState] = useState<'pending' | 'success' | 'error'>(initialPage === 'verify-email' && !initialVerifyToken ? 'error' : 'pending')
  const [verifyMessage, setVerifyMessage] = useState(initialPage === 'verify-email' && !initialVerifyToken ? 'Verification token is missing.' : 'Verifying your email...')

  const socketRef = useRef<Socket | null>(null)
  const dragSourceRef = useRef<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState>('idle')
  const [gameModes, setGameModes] = useState<GameMode[]>([])
  const [selectedMode, setSelectedMode] = useState<number | null>(null)
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const [moveLog, setMoveLog] = useState<string[]>([])
  const [moveCount, setMoveCount] = useState(0)
  const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

  const [gamesPage, setGamesPage] = useState<PaginatedGames>({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 })
  const [historyLimit, setHistoryLimit] = useState(10)
  const [replayGame, setReplayGame] = useState<Game | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (page !== 'verify-email') return
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('token')

    if (!verifyToken) {
      return
    }

    authService.verifyEmail({ token: verifyToken, email: '', otp: '' })
      .then(() => {
        setVerifyState('success')
        setVerifyMessage('Your email has been verified. You can sign in now.')
      })
      .catch((error) => {
        setVerifyState('error')
        setVerifyMessage(error instanceof Error ? error.message : 'Email verification failed.')
      })
  }, [page])

  const refreshProfile = useCallback(() => {
    if (!token) return Promise.resolve()
    return userService.getProfile(token).then(setUser)
  }, [token])

  useEffect(() => {
    if (!token) return

    gameService.getModes(token)
      .then((modes) => {
        if (modes.length === 0) return
        setGameModes(modes)
        setSelectedMode((current) => (modes.some((mode) => mode.gameModeId === current) ? current : modes[0].gameModeId))
      })
      .catch((error) => showToast('error', error.message))

    refreshProfile().catch((error) => {
      showToast('error', error.message)
      logout()
    })
  }, [refreshProfile, showToast, token])

  const loadGames = useCallback(
    async (pageNumber = gamesPage.page, limit = historyLimit) => {
      if (!user) return
      const data = await gameService.getByUser(user.userId, pageNumber, limit, token)
      setGamesPage(data)
    },
    [gamesPage.page, historyLimit, token, user],
  )

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const nextSocket = io(SOCKET_BASE, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    nextSocket.on('connect', () => showToast('success', 'Connected to the game server.'))
    nextSocket.on('connect_error', (error) => {
      setMatchState('idle')
      showToast('error', error.message)
    })
    nextSocket.on('matchmakingStatus', ({ status }: { status: string }) => {
      setMatchState(status === 'waiting' ? 'waiting' : 'idle')
      showToast('info', status === 'waiting' ? 'Searching for an opponent...' : 'Matchmaking cancelled.')
    })
    nextSocket.on('matchFound', (game: Game) => {
      setActiveGame(game)
      setMoveLog([])
      setMoveCount(0)
      setSelectedSquare(null)
      setMatchState('playing')
      setPage('play')
      showToast('success', 'Opponent found.')
    })
    nextSocket.on('gameState', (game: Game) => {
      setActiveGame(game)
      setMatchState(game.status === 'IN_PROGRESS' ? 'playing' : 'ended')
    })
    nextSocket.on('moveMade', (move: { fen: string; san: string; gameId: number; moveCount?: number }) => {
      setActiveGame((current) => (current ? { ...current, fen: move.fen } : current))
      setMoveLog((current) => [...current, move.san])
      setMoveCount((current) => move.moveCount ?? current + 1)
      setSelectedSquare(null)
    })
    nextSocket.on('gameOver', (payload: Partial<Game> & { status: string; reasonForEnding: string | null }) => {
      setActiveGame((current) =>
        current
          ? {
              ...current,
              status: payload.status,
              reasonForEnding: payload.reasonForEnding,
              playerWhite: payload.playerWhite ?? current.playerWhite,
              playerBlack: payload.playerBlack ?? current.playerBlack,
              playerWhiteEloChange: payload.playerWhiteEloChange ?? current.playerWhiteEloChange,
              playerBlackEloChange: payload.playerBlackEloChange ?? current.playerBlackEloChange,
            }
          : current,
      )
      setMatchState('ended')
      showToast('info', `Game over: ${statusLabel(payload.status)}.`)
      refreshProfile().catch(() => undefined)
      loadGames().catch(() => undefined)
    })
    nextSocket.on('gameActionRequested', (offer: PendingOffer) => {
      setPendingOffer(offer)
      showToast('warning', `Your opponent requested ${offer.type === 'draw' ? 'a draw' : 'to resign'}.`)
    })
    nextSocket.on('gameActionPending', ({ type }: { type: string }) => {
      showToast('info', `${type === 'draw' ? 'Draw' : 'Resignation'} request sent.`)
    })
    nextSocket.on('gameActionDeclined', ({ type }: { type: string }) => {
      showToast('warning', `${type === 'draw' ? 'Draw' : 'Resignation'} request declined.`)
    })
    nextSocket.on('gameActionResponded', ({ accepted }: { accepted: boolean }) => {
      showToast(accepted ? 'success' : 'info', accepted ? 'Request accepted.' : 'Request declined.')
    })
    nextSocket.on('moveError', ({ message }: { message: string }) => showToast('error', message))
    nextSocket.on('error', ({ message }: { message: string }) => showToast('error', message))

    socketRef.current = nextSocket

    return () => {
      nextSocket.disconnect()
      if (socketRef.current === nextSocket) {
        socketRef.current = null
      }
    }
  }, [loadGames, refreshProfile, showToast, token])

  const myColor = getPlayerColor(activeGame, user)
  const turn = (activeGame?.fen ?? START_FEN).split(' ')[1] === 'w' ? 'white' : 'black'
  const canMove = matchState === 'playing' && myColor === turn
  const activeBoardSquares = useMemo(() => orientSquares(parseFen(activeGame?.fen ?? START_FEN), myColor), [activeGame, myColor])
  const replayFen = replayIndex === 0 ? START_FEN : replayGame?.moves?.[replayIndex - 1]?.fen ?? replayGame?.fen ?? START_FEN
  const replaySquares = useMemo(() => orientSquares(parseFen(replayFen), getPlayerColor(replayGame, user) ?? 'white'), [replayFen, replayGame, user])
  const moveRows = useMemo(() => buildMoveRows(moveLog), [moveLog])
  const replayMoveRows = useMemo(() => buildMoveRows(replayGame?.moves?.map((move) => move.san) ?? []), [replayGame])

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    setUser(null)
    setGamesPage({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 })
    setActiveGame(null)
    setMatchState('idle')
    setPage('login')
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    const form = new FormData(event.currentTarget)

    try {
      const response = await authService.login({
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      if (!response.data?.token) {
        throw new Error(response.message || 'Sign in failed.')
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token)
      setToken(response.data.token)
      setPage('play')
      showToast('success', 'Signed in successfully.')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Sign in failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    const form = new FormData(event.currentTarget)

    try {
      await authService.register({
        email: String(form.get('email') ?? ''),
        username: String(form.get('username') ?? ''),
        password: String(form.get('password') ?? ''),
      })
      showToast('success', 'Account created. Check your email to verify it.')
      setPage('login')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Registration failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  function findMatch() {
    if (!selectedMode) {
      showToast('warning', 'Game modes are still loading.')
      return
    }
    const socket = socketRef.current
    if (!socket?.connected) {
      setMatchState('connecting')
      showToast('info', 'Connecting socket...')
      socket?.connect()
      return
    }
    setMatchState('waiting')
    setActiveGame(null)
    setMoveLog([])
    setMoveCount(0)
    setSelectedSquare(null)
    socket.emit('findMatch', { gameModeId: selectedMode })
  }

  function cancelFindMatch() {
    socketRef.current?.emit('cancelFindMatch')
    setMatchState('idle')
  }

  function requestAction(type: 'draw' | 'resign') {
    if (!activeGame) return
    const text = type === 'draw' ? 'send a draw request' : 'send a resignation request'
    if (!window.confirm(`Are you sure you want to ${text}?`)) return
    socketRef.current?.emit('requestGameAction', { gameId: activeGame.gameId, type })
  }

  function abortGame() {
    if (!activeGame) return
    if (!window.confirm('Abort this game? Elo will not change.')) return
    socketRef.current?.emit('abortGame', { gameId: activeGame.gameId })
  }

  function respondOffer(accepted: boolean) {
    if (!pendingOffer) return
    socketRef.current?.emit('respondGameAction', { offerId: pendingOffer.offerId, accepted })
    setPendingOffer(null)
  }

  function handleDragStart(square: Square, event: DragEvent<HTMLImageElement>) {
    if (!activeGame || !canMove || !square.piece || !isMyPiece(square.piece, myColor)) {
      event.preventDefault()
      return
    }
    dragSourceRef.current = square.name
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', square.name)
  }

  function handleDrop(target: Square, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    const from = event.dataTransfer.getData('text/plain') || dragSourceRef.current
    dragSourceRef.current = null
    if (!activeGame || !canMove || !from || from === target.name) return

    socketRef.current?.emit('makeMove', {
      gameId: activeGame.gameId,
      from,
      to: target.name,
      promotion: 'q',
    })
  }

  function handleSquareClick(square: Square) {
    if (!activeGame || !canMove) return

    if (!selectedSquare) {
      if (square.piece && isMyPiece(square.piece, myColor)) {
        setSelectedSquare(square.name)
      }
      return
    }

    if (selectedSquare === square.name) {
      setSelectedSquare(null)
      return
    }

    if (square.piece && isMyPiece(square.piece, myColor)) {
      setSelectedSquare(square.name)
      return
    }

    socketRef.current?.emit('makeMove', {
      gameId: activeGame.gameId,
      from: selectedSquare,
      to: square.name,
      promotion: 'q',
    })
  }

  async function openReplay(gameId: number) {
    try {
      const game = await gameService.getDetail(gameId, token)
      setReplayGame(game)
      setReplayIndex(0)
      setPage('replay')
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not load game detail.')
    }
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <button className="brand" onClick={() => setPage(token ? 'play' : 'login')} type="button">
          <span className="brand-mark">64</span>
          <span>Chess 64 Squares</span>
        </button>
        <div className="nav-actions">
          {token ? (
            <>
              <button className={page === 'play' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('play')}>
                Play
              </button>
              <button
                className={page === 'profile' ? 'nav-link active' : 'nav-link'}
                onClick={() => {
                  setPage('profile')
                  loadGames(1, historyLimit).catch((error) => showToast('error', error.message))
                }}
              >
                Profile
              </button>
              <button className="button tertiary small" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className={page === 'login' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('login')}>
                Sign in
              </button>
              <button className="button primary small" onClick={() => setPage('register')}>
                Register
              </button>
            </>
          )}
        </div>
      </nav>

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      {pendingOffer && (
        <div className="offer-toast">
          <strong>{pendingOffer.type === 'draw' ? 'Draw request' : 'Resignation request'}</strong>
          <span>Your opponent is waiting for your response.</span>
          <div>
            <button className="button primary small" onClick={() => respondOffer(true)}>Accept</button>
            <button className="button tertiary small" onClick={() => respondOffer(false)}>Decline</button>
          </div>
        </div>
      )}

      {page === 'verify-email' && (
        <VerifyEmailPage state={verifyState} message={verifyMessage} onGoToLogin={() => setPage('login')} />
      )}

      {!token && page === 'login' && (
        <LoginPage authBusy={authBusy} onLogin={handleLogin} />
      )}

      {!token && page === 'register' && (
        <RegisterPage authBusy={authBusy} onRegister={handleRegister} />
      )}

      {token && page === 'profile' && (
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
                  onChange={(event) => {
                    const nextLimit = Number(event.target.value)
                    setHistoryLimit(nextLimit)
                    loadGames(1, nextLimit).catch((error) => showToast('error', error.message))
                  }}
                >
                  {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <button className="button tertiary small" onClick={() => loadGames(gamesPage.page, historyLimit).catch((error) => showToast('error', error.message))}>
                  Reload
                </button>
              </div>
            </div>
            <div className="game-list">
              {gamesPage.items.length === 0 && <div className="empty">No games recorded yet.</div>}
              {gamesPage.items.map((game) => (
                <article className="game-row" key={game.gameId}>
                  <div>
                    <strong>#{game.gameId}</strong>
                    <span>White: {game.playerWhite.username} ({formatElo(game.playerWhiteElo ?? game.playerWhite.elo, game.playerWhiteEloChange)})</span>
                    <span>Black: {game.playerBlack.username} ({formatElo(game.playerBlackElo ?? game.playerBlack.elo, game.playerBlackEloChange)})</span>
                  </div>
                  <span>{statusLabel(game.status)}</span>
                  <span>{reasonLabel(game.reasonForEnding)}</span>
                  <span>{formatDate(game.date)}</span>
                  <button className="button tertiary small" onClick={() => openReplay(game.gameId)}>Detail</button>
                </article>
              ))}
            </div>
            <div className="pagination">
              <button className="button tertiary small" disabled={gamesPage.page <= 1} onClick={() => loadGames(gamesPage.page - 1, historyLimit)}>Previous</button>
              <span>Page {gamesPage.page} of {gamesPage.totalPages}</span>
              <button className="button tertiary small" disabled={gamesPage.page >= gamesPage.totalPages} onClick={() => loadGames(gamesPage.page + 1, historyLimit)}>Next</button>
            </div>
          </section>
        </section>
      )}

      {token && page === 'play' && (
        <section className="play-page">
          <aside className="match-panel">
            <p className="eyebrow">Matchmaking</p>
            <h1>Ready for 64 squares</h1>
            {!activeGame && (
              <div className="mode-list">
                {gameModes.length === 0 && <span className="empty compact">Loading game modes...</span>}
                {gameModes.map((mode) => (
                  <button className={selectedMode === mode.gameModeId ? 'mode-card selected' : 'mode-card'} key={mode.gameModeId} onClick={() => setSelectedMode(mode.gameModeId)} type="button">
                    <strong>{mode.gameModeName}</strong>
                    <span>{mode.time}+{mode.plusPerMove}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="match-actions">
              {matchState === 'waiting' || matchState === 'connecting' ? (
                <button className="button secondary" onClick={cancelFindMatch}>Cancel search</button>
              ) : (
                !activeGame && <button className="button primary" onClick={findMatch} disabled={!selectedMode}>Find opponent</button>
              )}
              {(matchState === 'waiting' || matchState === 'connecting') && <span className="loading-inline"><span /> Searching...</span>}
            </div>
          </aside>

          <section className="board-area">
            <div className="board-header">
              <div>
                <span className="badge">{myColor ? `You are ${myColor}` : 'No active game'}</span>
                <h2>{activeGame ? statusLabel(activeGame.status) : 'Board ready'}</h2>
              </div>
              <div className="board-actions">
                {activeGame && matchState === 'playing' && (
                  <>
                    <button className="button tertiary small" onClick={() => requestAction('draw')}>Draw</button>
                    {moveCount < 3 ? (
                      <button className="button tertiary small" onClick={abortGame}>Abort</button>
                    ) : (
                      <button className="button tertiary small danger" onClick={() => requestAction('resign')}>Resign</button>
                    )}
                  </>
                )}
                <span className="turn-pill">{canMove ? 'Your turn' : `${capitalize(turn)} to move`}</span>
              </div>
            </div>

            <PlayerCard label="Opponent" player={getOpponentPlayer(activeGame, user)} snapshotElo={getOpponentElo(activeGame, user)} eloChange={getOpponentEloChange(activeGame, user)} active={activeGame ? turn !== myColor : false} />
            <ChessBoard squares={activeBoardSquares} orientation={myColor ?? 'white'} selectedSquare={selectedSquare} onDragStart={handleDragStart} onDrop={handleDrop} onSquareClick={handleSquareClick} />
            <PlayerCard label="You" player={getSelfPlayer(activeGame, user)} snapshotElo={getSelfElo(activeGame, user)} eloChange={getSelfEloChange(activeGame, user)} active={activeGame ? turn === myColor : false} />
          </section>

          <aside className="moves-panel">
            <p className="eyebrow">Scoresheet</p>
            <h2>Moves</h2>
            <MoveTable rows={moveRows} emptyText="No moves yet." />
          </aside>
        </section>
      )}

      {token && page === 'replay' && replayGame && (
        <section className="play-page replay-page">
          <aside className="match-panel">
            <p className="eyebrow">Replay</p>
            <h1>Game #{replayGame.gameId}</h1>
            <div className="player-stack">
              <PlayerCard label="White" player={replayGame.playerWhite} snapshotElo={replayGame.playerWhiteElo} eloChange={replayGame.playerWhiteEloChange} active={false} />
              <PlayerCard label="Black" player={replayGame.playerBlack} snapshotElo={replayGame.playerBlackElo} eloChange={replayGame.playerBlackEloChange} active={false} />
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
                <button className="icon-button" title="First" onClick={() => setReplayIndex(0)}>«</button>
                <button className="icon-button" title="Previous" onClick={() => setReplayIndex((index) => Math.max(0, index - 1))}>‹</button>
                <button className="icon-button" title="Next" onClick={() => setReplayIndex((index) => Math.min(replayGame.moves?.length ?? 0, index + 1))}>›</button>
                <button className="icon-button" title="Last" onClick={() => setReplayIndex(replayGame.moves?.length ?? 0)}>»</button>
              </div>
            </div>
            <ChessBoard squares={replaySquares} orientation={getPlayerColor(replayGame, user) ?? 'white'} />
          </section>

          <aside className="moves-panel">
            <p className="eyebrow">Scoresheet</p>
            <h2>Moves</h2>
            <MoveTable rows={replayMoveRows} emptyText="No moves recorded." />
          </aside>
        </section>
      )}
    </main>
  )
}

function orientSquares(squares: Square[], color: Color | null) {
  return color === 'black' ? [...squares].reverse() : squares
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
  if (!game || !color) return undefined
  return color === 'white' ? game.playerWhiteEloChange : game.playerBlackEloChange
}

function getOpponentEloChange(game: Game | null, user: User | null) {
  const color = getPlayerColor(game, user)
  if (!game || !color) return undefined
  return color === 'white' ? game.playerBlackEloChange : game.playerWhiteEloChange
}

function isMyPiece(piece: string, color: Color | null) {
  if (!color) return false
  return color === 'white' ? piece === piece.toUpperCase() : piece === piece.toLowerCase()
}

function buildMoveRows(moves: string[]) {
  const rows: { number: number; white: string; black: string }[] = []
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({ number: index / 2 + 1, white: moves[index] ?? '', black: moves[index + 1] ?? '' })
  }
  return rows
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value?: string | Date) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatElo(elo?: number, change?: number) {
  if (elo === undefined) return '-'
  if (!change) return String(elo)
  return `${elo} ${change > 0 ? '+' : ''}${change}`
}

export default App
