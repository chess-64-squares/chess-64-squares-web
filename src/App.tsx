import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'
import { AppDialog } from './component/AppDialog'
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
import { ProfilePage } from './pages/ProfilePage'
import { PlayPage } from './pages/PlayPage'
import { HistoryPage } from './pages/HistoryPage'
import type { Color, Game, GameMode, MatchState, Page, PaginatedGames, PendingOffer, Square, ToastType, User } from './types'

const SOCKET_BASE = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:8000/game'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function getPageFromPath(): Page {
  const path = window.location.pathname
  if (path === '/register') return 'register'
  if (path === '/profile' || path.startsWith('/profile/')) return 'profile'
  if (path.startsWith('/history/')) return 'replay'
  if (path === '/verify-email') return 'verify-email'
  if (path === '/play') return 'play'
  return getStoredToken() ? 'play' : 'login'
}

function getPathForPage(page: Page, detailId?: number) {
  if (page === 'replay') return `/history/${detailId ?? ''}`
  if (page === 'profile') return '/profile'
  if (page === 'play') return '/play'
  return `/${page}`
}

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
  const initialPage = getPageFromPath()
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
  const [confirmAction, setConfirmAction] = useState<'draw' | 'resign' | 'abort' | null>(null)
  const [resultGame, setResultGame] = useState<Game | null>(null)
  const [clockTick, setClockTick] = useState(0)

  const [gamesPage, setGamesPage] = useState<PaginatedGames>({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 })
  const [historyLimit, setHistoryLimit] = useState(10)
  const [replayGame, setReplayGame] = useState<Game | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message })
  }, [])

  const navigate = useCallback((nextPage: Page, detailId?: number) => {
    const nextPath = getPathForPage(nextPage, detailId)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setPage(nextPage)
  }, [])

  useEffect(() => {
    const syncRoute = () => setPage(getPageFromPath())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (matchState !== 'playing') return
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [matchState])

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
    if (!token || page !== 'replay') return
    const gameId = Number(window.location.pathname.split('/').at(-1))
    if (!Number.isInteger(gameId) || gameId <= 0 || replayGame?.gameId === gameId) return
    gameService.getDetail(gameId, token)
      .then((game) => {
        setReplayGame(game)
        setReplayIndex(0)
      })
      .catch((error) => showToast('error', error instanceof Error ? error.message : 'Could not load game detail.'))
  }, [page, replayGame?.gameId, showToast, token])

  useEffect(() => {
    if (token && page === 'profile' && user) {
      loadGames(1, historyLimit).catch((error) => showToast('error', error.message))
    }
  }, [historyLimit, loadGames, page, showToast, token, user])

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
      setResultGame(null)
      setMoveLog([])
      setMoveCount(0)
      setSelectedSquare(null)
      setMatchState('playing')
      navigate('play')
      showToast('success', 'Opponent found.')
    })
    nextSocket.on('gameState', (game: Game) => {
      setActiveGame(game)
      setMatchState(game.status === 'IN_PROGRESS' ? 'playing' : 'ended')
    })
    nextSocket.on('moveMade', (move: Partial<Game> & { fen: string; san: string; gameId: number; moveCount?: number }) => {
      setActiveGame((current) =>
        current
          ? {
            ...current,
            fen: move.fen,
            playerWhiteTimeMs: move.playerWhiteTimeMs ?? current.playerWhiteTimeMs,
            playerBlackTimeMs: move.playerBlackTimeMs ?? current.playerBlackTimeMs,
            lastMoveAt: move.lastMoveAt ?? current.lastMoveAt,
          }
          : current,
      )
      setMoveLog((current) => [...current, move.san])
      setMoveCount((current) => move.moveCount ?? current + 1)
      setSelectedSquare(null)
    })
    nextSocket.on('gameOver', (payload: Partial<Game> & { status: string; reasonForEnding: string | null }) => {
      setActiveGame((current) => {
        const nextGame = current
          ? {
            ...current,
            status: payload.status,
            reasonForEnding: payload.reasonForEnding,
            playerWhite: payload.playerWhite ?? current.playerWhite,
            playerBlack: payload.playerBlack ?? current.playerBlack,
            playerWhiteTimeMs: payload.playerWhiteTimeMs ?? current.playerWhiteTimeMs,
            playerBlackTimeMs: payload.playerBlackTimeMs ?? current.playerBlackTimeMs,
            lastMoveAt: payload.lastMoveAt ?? current.lastMoveAt,
          }
          : null
        if (nextGame) setResultGame(nextGame)
        return nextGame
      },
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
  const displayWhiteTimeMs = getDisplayTime(activeGame, 'white', turn, matchState, clockTick)
  const displayBlackTimeMs = getDisplayTime(activeGame, 'black', turn, matchState, clockTick)
  const activeBoardSquares = useMemo(() => orientSquares(parseFen(activeGame?.fen ?? START_FEN), myColor), [activeGame, myColor])
  const replayFen = replayIndex === 0 ? START_FEN : replayGame?.moves?.[replayIndex - 1]?.fen ?? replayGame?.fen ?? START_FEN
  const replaySquares = useMemo(() => orientSquares(parseFen(replayFen), getPlayerColor(replayGame, user) ?? 'white'), [replayFen, replayGame, user])
  const moveRows = useMemo(() => buildMoveRows(moveLog), [moveLog])
  const replayMoveRows = useMemo(() => buildMoveRows(replayGame?.moves?.map((move) => move.san) ?? []), [replayGame])

  useEffect(() => {
    if (!activeGame || matchState !== 'playing') return
    const currentTime = turn === 'white' ? displayWhiteTimeMs : displayBlackTimeMs
    if (currentTime <= 0) {
      socketRef.current?.emit('flagTimeout', { gameId: activeGame.gameId })
    }
  }, [activeGame, displayBlackTimeMs, displayWhiteTimeMs, matchState, turn])

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    setUser(null)
    setGamesPage({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 })
    setActiveGame(null)
    setResultGame(null)
    setMatchState('idle')
    navigate('login')
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
      navigate('play')
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
      navigate('login')
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
    setConfirmAction(type)
  }

  function abortGame() {
    if (!activeGame) return
    setConfirmAction('abort')
  }

  function runConfirmedAction() {
    if (!activeGame || !confirmAction) return

    if (confirmAction === 'draw') {
      socketRef.current?.emit('requestGameAction', { gameId: activeGame.gameId, type: 'draw' })
    }
    if (confirmAction === 'resign') {
      socketRef.current?.emit('resign', { gameId: activeGame.gameId })
    }
    if (confirmAction === 'abort') {
      socketRef.current?.emit('abortGame', { gameId: activeGame.gameId })
    }
    setConfirmAction(null)
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
      navigate('replay', game.gameId)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not load game detail.')
    }
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <button className="brand" onClick={() => navigate(token ? 'play' : 'login')} type="button">
          <span className="brand-mark">64</span>
          <span>Chess 64 Squares</span>
        </button>
        <div className="nav-actions">
          {token ? (
            <>
              <button className={page === 'play' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('play')}>
                Play
              </button>
              <button
                className={page === 'profile' ? 'nav-link active' : 'nav-link'}
                onClick={() => {
                  navigate('profile')
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
              <button className={page === 'login' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('login')}>
                Sign in
              </button>
              <button className="button primary small" onClick={() => navigate('register')}>
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

      {confirmAction && (
        <AppDialog title={confirmTitle(confirmAction)} message={confirmMessage(confirmAction)}>
          <button className="button tertiary" onClick={() => setConfirmAction(null)}>Cancel</button>
          <button className={confirmAction === 'resign' ? 'button tertiary danger' : 'button primary'} onClick={runConfirmedAction}>
            Confirm
          </button>
        </AppDialog>
      )}

      {resultGame && (
        <AppDialog title={resultTitle(resultGame, user)} message={`${statusLabel(resultGame.status)} · ${reasonLabel(resultGame.reasonForEnding)}`}>
          <button className="button tertiary" onClick={() => navigate('profile')}>View history</button>
          <button className="button primary" onClick={() => {
            setResultGame(null)
            setActiveGame(null)
            setMoveLog([])
            setMoveCount(0)
            setMatchState('idle')
            navigate('play')
          }}>
            Find another match
          </button>
        </AppDialog>
      )}

      {page === 'verify-email' && (
        <VerifyEmailPage state={verifyState} message={verifyMessage} onGoToLogin={() => navigate('login')} />
      )}

      {!token && page === 'login' && (
        <LoginPage authBusy={authBusy} onLogin={handleLogin} />
      )}

      {!token && page === 'register' && (
        <RegisterPage authBusy={authBusy} onRegister={handleRegister} />
      )}

      {token && page === 'profile' && (
        <ProfilePage>
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
        </ProfilePage>
      )}

      {token && page === 'play' && (
        <PlayPage>
          <aside className="match-panel">
            <p className="eyebrow">Matchmaking</p>
            <h1>Ready for 64 squares</h1>
            {(!activeGame || matchState === 'ended') && (
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
                (!activeGame || matchState === 'ended') && <button className="button primary" onClick={findMatch} disabled={!selectedMode}>Find opponent</button>
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

            <PlayerCard label="Opponent" player={getOpponentPlayer(activeGame, user)} snapshotElo={getOpponentElo(activeGame, user)} time={formatClock(getOpponentTime(activeGame, user, displayWhiteTimeMs, displayBlackTimeMs))} active={activeGame ? turn !== myColor : false} />
            <ChessBoard squares={activeBoardSquares} orientation={myColor ?? 'white'} selectedSquare={selectedSquare} onDragStart={handleDragStart} onDrop={handleDrop} onSquareClick={handleSquareClick} />
            <PlayerCard label="You" player={getSelfPlayer(activeGame, user)} snapshotElo={getSelfElo(activeGame, user)} time={formatClock(getSelfTime(activeGame, user, displayWhiteTimeMs, displayBlackTimeMs))} active={activeGame ? turn === myColor : false} />
          </section>

          <aside className="moves-panel">
            <p className="eyebrow">Scoresheet</p>
            <h2>Moves</h2>
            <MoveTable rows={moveRows} emptyText="No moves yet." />
          </aside>
        </PlayPage>
      )}

      {token && page === 'replay' && replayGame && (
        <HistoryPage>
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
        </HistoryPage>
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

function getDisplayTime(game: Game | null, color: Color, turn: Color, matchState: MatchState, tick: number) {
  void tick
  if (!game) return 0
  const base = color === 'white' ? game.playerWhiteTimeMs ?? 0 : game.playerBlackTimeMs ?? 0
  if (matchState !== 'playing' || turn !== color || !game.lastMoveAt) return base
  return Math.max(0, base - (Date.now() - new Date(game.lastMoveAt).getTime()))
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

function formatClock(value?: number) {
  if (value === undefined) return undefined
  const totalSeconds = Math.ceil(Math.max(0, value) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function confirmTitle(action: 'draw' | 'resign' | 'abort') {
  if (action === 'draw') return 'Offer a draw?'
  if (action === 'resign') return 'Resign this game?'
  return 'Abort this game?'
}

function confirmMessage(action: 'draw' | 'resign' | 'abort') {
  if (action === 'draw') return 'Your opponent will need to accept before the game is drawn.'
  if (action === 'resign') return 'This ends the game immediately and your opponent wins.'
  return 'Available only in the opening moves. Elo will not change.'
}

function resultTitle(game: Game, user: User | null) {
  const color = getPlayerColor(game, user)
  if (game.status === 'DRAW') return 'Game drawn'
  if (!color) return 'Game over'
  const didWin = (color === 'white' && game.status === 'WHITE_WINS') || (color === 'black' && game.status === 'BLACK_WINS')
  return didWin ? 'You won' : 'You lost'
}

export default App
