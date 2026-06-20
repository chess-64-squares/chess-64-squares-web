import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'

type Page = 'login' | 'register' | 'profile' | 'play' | 'verify-email' | 'replay'
type ToastType = 'success' | 'error' | 'warning' | 'info'
type MatchState = 'idle' | 'connecting' | 'waiting' | 'playing' | 'ended'
type Color = 'white' | 'black'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T | null
  errorCode?: string
}

type User = {
  userId: number
  username: string
  email?: string
  elo: number
  status: string
  isEmailVerified?: boolean
  createdAt?: string
}

type GameMode = {
  gameModeId: number
  gameModeName: string
  time: number
  plusPerMove: number
}

type Move = {
  moveNumber: number
  isWhite: boolean
  san: string
  fen: string
}

type Game = {
  gameId: number
  playerWhite: User
  playerBlack: User
  gameMode?: GameMode
  playerWhiteElo?: number
  playerBlackElo?: number
  fen: string
  status: string
  reasonForEnding: string | null
  date?: string
  moves?: Move[]
}

type PaginatedGames = {
  items: Game[]
  total: number
  page: number
  limit: number
  totalPages: number
}

type Square = {
  name: string
  piece: string | null
}

type PendingOffer = {
  offerId: string
  gameId: number
  type: 'draw' | 'resign'
  fromUserId: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
const SOCKET_BASE = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:8000/game'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const defaultGameModes: GameMode[] = [
  { gameModeId: 1, gameModeName: 'Rapid 10+0', time: 10, plusPerMove: 0 },
  { gameModeId: 2, gameModeName: 'Blitz 5+0', time: 5, plusPerMove: 0 },
  { gameModeId: 3, gameModeName: 'Bullet 1+0', time: 1, plusPerMove: 0 },
]

const pieceImages: Record<string, string> = {
  p: new URL('./assets/chess/chessman/default/bp.png', import.meta.url).href,
  r: new URL('./assets/chess/chessman/default/br.png', import.meta.url).href,
  n: new URL('./assets/chess/chessman/default/bn.png', import.meta.url).href,
  b: new URL('./assets/chess/chessman/default/bb.png', import.meta.url).href,
  q: new URL('./assets/chess/chessman/default/bq.png', import.meta.url).href,
  k: new URL('./assets/chess/chessman/default/bk.png', import.meta.url).href,
  P: new URL('./assets/chess/chessman/default/wp.png', import.meta.url).href,
  R: new URL('./assets/chess/chessman/default/wr.png', import.meta.url).href,
  N: new URL('./assets/chess/chessman/default/wn.png', import.meta.url).href,
  B: new URL('./assets/chess/chessman/default/wb.png', import.meta.url).href,
  Q: new URL('./assets/chess/chessman/default/wq.png', import.meta.url).href,
  K: new URL('./assets/chess/chessman/default/wk.png', import.meta.url).href,
}

function getStoredToken() {
  return localStorage.getItem('chess64.token') ?? ''
}

async function request<T>(path: string, options: RequestInit = {}, token = '') {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new Error(`Could not connect to the API at ${API_BASE}.`)
  }

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !body?.success) {
    throw new Error(body?.message ?? 'Request failed')
  }
  return body.data as T
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
  const [gameModes, setGameModes] = useState<GameMode[]>(defaultGameModes)
  const [selectedMode, setSelectedMode] = useState(defaultGameModes[0].gameModeId)
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const [moveLog, setMoveLog] = useState<string[]>([])
  const [moveCount, setMoveCount] = useState(0)
  const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null)

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

    request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verifyToken }),
    })
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
    return request<User>('/user/profile', {}, token).then(setUser)
  }, [token])

  useEffect(() => {
    if (!token) return

    request<GameMode[]>('/game/modes', {}, token)
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
      const data = await request<PaginatedGames>(`/game/user/${user.userId}?page=${pageNumber}&limit=${limit}`, {}, token)
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
    localStorage.removeItem('chess64.token')
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
      const data = await request<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
        }),
      })
      localStorage.setItem('chess64.token', data.token)
      setToken(data.token)
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
      await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          username: form.get('username'),
          password: form.get('password'),
        }),
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

  async function openReplay(gameId: number) {
    try {
      const game = await request<Game>(`/game/${gameId}`, {}, token)
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
        <AuthPanel title={verifyState === 'success' ? 'Email verified' : verifyState === 'error' ? 'Verification failed' : 'Verifying email'} caption={verifyMessage}>
          <button className="button primary" onClick={() => setPage('login')}>Go to sign in</button>
        </AuthPanel>
      )}

      {!token && page === 'login' && (
        <AuthPanel title="Welcome back" caption="Sign in to find a match and continue your run.">
          <form className="form" onSubmit={handleLogin}>
            <label>
              Username or email
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="button primary" disabled={authBusy}>
              {authBusy ? 'Working...' : 'Sign in'}
            </button>
          </form>
        </AuthPanel>
      )}

      {!token && page === 'register' && (
        <AuthPanel title="Create account" caption="Join the board and start with the default Elo rating.">
          <form className="form" onSubmit={handleRegister}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Username
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="new-password" required />
            </label>
            <button className="button primary" disabled={authBusy}>
              {authBusy ? 'Working...' : 'Register'}
            </button>
          </form>
        </AuthPanel>
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
                    <span>White: {game.playerWhite.username} ({game.playerWhiteElo ?? game.playerWhite.elo})</span>
                    <span>Black: {game.playerBlack.username} ({game.playerBlackElo ?? game.playerBlack.elo})</span>
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
            <div className="mode-list">
              {gameModes.map((mode) => (
                <button className={selectedMode === mode.gameModeId ? 'mode-card selected' : 'mode-card'} key={mode.gameModeId} onClick={() => setSelectedMode(mode.gameModeId)} type="button">
                  <strong>{mode.gameModeName}</strong>
                  <span>{mode.time}+{mode.plusPerMove}</span>
                </button>
              ))}
            </div>
            <div className="match-actions">
              {matchState === 'waiting' ? (
                <button className="button secondary" onClick={cancelFindMatch}>Cancel search</button>
              ) : (
                <button className="button primary" onClick={findMatch}>Find opponent</button>
              )}
            </div>
            <div className="player-stack">
              <PlayerCard label="White" player={activeGame?.playerWhite} snapshotElo={activeGame?.playerWhiteElo} active={turn === 'white'} />
              <PlayerCard label="Black" player={activeGame?.playerBlack} snapshotElo={activeGame?.playerBlackElo} active={turn === 'black'} />
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

            <ChessBoard squares={activeBoardSquares} orientation={myColor ?? 'white'} onDragStart={handleDragStart} onDrop={handleDrop} />
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
              <PlayerCard label="White" player={replayGame.playerWhite} snapshotElo={replayGame.playerWhiteElo} active={false} />
              <PlayerCard label="Black" player={replayGame.playerBlack} snapshotElo={replayGame.playerBlackElo} active={false} />
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

function AuthPanel({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <section className="auth-page">
      <div className="auth-copy">
        <p className="eyebrow">Chess 64 Squares</p>
        <h1>{title}</h1>
        <p>{caption}</p>
      </div>
      <div className="auth-card">{children}</div>
    </section>
  )
}

function ChessBoard({
  squares,
  orientation,
  onDragStart,
  onDrop,
}: {
  squares: Square[]
  orientation: Color
  onDragStart?: (square: Square, event: DragEvent<HTMLImageElement>) => void
  onDrop?: (square: Square, event: DragEvent<HTMLButtonElement>) => void
}) {
  const files = orientation === 'black' ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = orientation === 'black' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1']

  return (
    <div className="board-frame">
      <div className="rank-labels" aria-hidden="true">
        {ranks.map((rank) => <span key={rank}>{rank}</span>)}
      </div>
      <div className="chess-board" aria-label="Chess board">
        {squares.map((square) => (
          <button className="square" key={square.name} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop?.(square, event)} type="button">
            {square.piece && (
              <img src={pieceImages[square.piece]} alt={square.piece} draggable={!!onDragStart} onDragStart={(event) => onDragStart?.(square, event)} />
            )}
          </button>
        ))}
      </div>
      <div className="file-labels" aria-hidden="true">
        {files.map((file) => <span key={file}>{file}</span>)}
      </div>
    </div>
  )
}

function MoveTable({ rows, emptyText }: { rows: { number: number; white: string; black: string }[]; emptyText: string }) {
  return (
    <div className="moves-table">
      <div className="moves-head"><span>#</span><span>White</span><span>Black</span></div>
      {rows.length === 0 && <span className="empty compact">{emptyText}</span>}
      {rows.map((row) => (
        <div className="moves-row" key={row.number}>
          <span>{row.number}</span>
          <span>{row.white}</span>
          <span>{row.black}</span>
        </div>
      ))}
    </div>
  )
}

function PlayerCard({ label, player, snapshotElo, active }: { label: string; player?: User; snapshotElo?: number; active: boolean }) {
  return (
    <article className={active ? 'player-card active' : 'player-card'}>
      <span>{label}</span>
      <strong>{player?.username ?? 'Waiting'}</strong>
      <small>Elo {snapshotElo ?? player?.elo ?? '-'}</small>
    </article>
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

function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App
