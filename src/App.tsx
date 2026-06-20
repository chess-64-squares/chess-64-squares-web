import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'

type Page = 'login' | 'register' | 'profile' | 'play'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T | null
  errorCode?: string
}

type User = {
  userId: number
  username: string
  email: string
  elo: number
  status: string
  isEmailVerified: boolean
  createdAt: string
}

type GameMode = {
  gameModeId: number
  gameModeName: string
  time: number
  plusPerMove: number
}

type Game = {
  gameId: number
  playerWhite: User
  playerBlack: User
  gameMode?: GameMode
  fen: string
  status: string
  reasonForEnding: string | null
  date?: string
}

type Square = {
  name: string
  piece: string | null
}

type MatchState = 'idle' | 'connecting' | 'waiting' | 'playing' | 'ended'

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
    throw new Error(`Khong ket noi duoc backend tai ${API_BASE}. Hay kiem tra server API dang chay.`)
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
    WAITING_FOR_OPPONENT: 'Dang doi doi thu',
    IN_PROGRESS: 'Dang dien ra',
    WHITE_WINS: 'Trang thang',
    BLACK_WINS: 'Den thang',
    DRAW: 'Hoa',
    ABORTED: 'Da huy',
    FINISHED: 'Da ket thuc',
  }
  return labels[status] ?? status
}

function App() {
  const [page, setPage] = useState<Page>(getStoredToken() ? 'play' : 'login')
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState<User | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [notice, setNotice] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const [matchState, setMatchState] = useState<MatchState>('idle')
  const [gameModes, setGameModes] = useState<GameMode[]>(defaultGameModes)
  const [selectedMode, setSelectedMode] = useState(defaultGameModes[0].gameModeId)
  const [activeGame, setActiveGame] = useState<Game | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [moveLog, setMoveLog] = useState<string[]>([])

  useEffect(() => {
    if (!token) return

    request<GameMode[]>('/game/modes', {}, token)
      .then((modes) => {
        if (modes.length === 0) {
          return
        }

        setGameModes(modes)
        setSelectedMode((current) =>
          modes.some((mode) => mode.gameModeId === current) ? current : modes[0].gameModeId,
        )
      })
      .catch((error) => setNotice(error.message))

    request<User>('/user/profile', {}, token)
      .then(setUser)
      .catch((error) => {
        setNotice(error.message)
        logout()
      })
  }, [token])

  const loadGames = useCallback(async () => {
    if (!user) return
    const data = await request<Game[]>(`/game/user/${user.userId}`, {}, token)
    setGames(data)
  }, [token, user])

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

    nextSocket.on('connect', () => setNotice('Da ket noi may chu game'))
    nextSocket.on('connect_error', (error) => {
      setMatchState('idle')
      setNotice(error.message)
    })
    nextSocket.on('matchmakingStatus', ({ status }: { status: string }) => {
      setMatchState(status === 'waiting' ? 'waiting' : 'idle')
      setNotice(status === 'waiting' ? 'Dang tim doi thu phu hop...' : 'Da huy tim tran')
    })
    nextSocket.on('matchFound', (game: Game) => {
      setActiveGame(game)
      setMoveLog([])
      setSelectedSquare(null)
      setMatchState('playing')
      setPage('play')
      setNotice('Da tim thay doi thu')
    })
    nextSocket.on('gameState', (game: Game) => {
      setActiveGame(game)
      setMatchState(game.status === 'IN_PROGRESS' ? 'playing' : 'ended')
    })
    nextSocket.on('moveMade', (move: { fen: string; san: string; gameId: number }) => {
      setActiveGame((current) => (current ? { ...current, fen: move.fen } : current))
      setMoveLog((current) => [...current, move.san])
      setSelectedSquare(null)
    })
    nextSocket.on('gameOver', (payload: { status: string; reasonForEnding: string | null }) => {
      setActiveGame((current) =>
        current ? { ...current, status: payload.status, reasonForEnding: payload.reasonForEnding } : current,
      )
      setMatchState('ended')
      setNotice(`Van dau ket thuc: ${statusLabel(payload.status)}`)
      loadGames()
    })
    nextSocket.on('moveError', ({ message }: { message: string }) => setNotice(message))
    nextSocket.on('error', ({ message }: { message: string }) => setNotice(message))

    socketRef.current = nextSocket

    return () => {
      nextSocket.disconnect()
      if (socketRef.current === nextSocket) {
        socketRef.current = null
      }
    }
  }, [loadGames, token])

  const boardSquares = useMemo(() => {
    const squares = parseFen(activeGame?.fen ?? START_FEN)
    const color = getPlayerColor(activeGame, user)
    return color === 'black' ? [...squares].reverse() : squares
  }, [activeGame, user])

  const myColor = getPlayerColor(activeGame, user)
  const turn = (activeGame?.fen ?? START_FEN).split(' ')[1] === 'w' ? 'white' : 'black'
  const canMove = matchState === 'playing' && myColor === turn

  function logout() {
    localStorage.removeItem('chess64.token')
    setToken('')
    setUser(null)
    setGames([])
    setActiveGame(null)
    setMatchState('idle')
    setPage('login')
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setNotice('')
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dang nhap that bai')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setNotice('')
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
      setNotice('Dang ki thanh cong. Hay kiem tra email de xac thuc neu backend yeu cau.')
      setPage('login')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Dang ki that bai')
    } finally {
      setAuthBusy(false)
    }
  }

  function findMatch() {
    const socket = socketRef.current
    if (!socket?.connected) {
      setMatchState('connecting')
      setNotice('Dang ket noi socket...')
      socket?.connect()
      return
    }
    setMatchState('waiting')
    setActiveGame(null)
    socket.emit('findMatch', { gameModeId: selectedMode })
  }

  function cancelFindMatch() {
    socketRef.current?.emit('cancelFindMatch')
    setMatchState('idle')
  }

  function resign() {
    if (!activeGame) return
    socketRef.current?.emit('resign', { gameId: activeGame.gameId })
  }

  function selectSquare(square: Square) {
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

    socketRef.current?.emit('makeMove', {
      gameId: activeGame.gameId,
      from: selectedSquare,
      to: square.name,
      promotion: 'q',
    })
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
                Dau co
              </button>
              <button
                className={page === 'profile' ? 'nav-link active' : 'nav-link'}
                onClick={() => {
                  setPage('profile')
                  loadGames().catch((error) => setNotice(error.message))
                }}
              >
                Ca nhan
              </button>
              <button className="button tertiary small" onClick={logout}>
                Dang xuat
              </button>
            </>
          ) : (
            <>
              <button className={page === 'login' ? 'nav-link active' : 'nav-link'} onClick={() => setPage('login')}>
                Dang nhap
              </button>
              <button className="button primary small" onClick={() => setPage('register')}>
                Dang ki
              </button>
            </>
          )}
        </div>
      </nav>

      {notice && <div className="toast">{notice}</div>}

      {!token && page === 'login' && (
        <AuthPanel title="Chao mung tro lai" caption="Dang nhap de tim tran va tiep tuc chuoi van cua ban.">
          <form className="form" onSubmit={handleLogin}>
            <label>
              Ten dang nhap
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Mat khau
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="button primary" disabled={authBusy}>
              {authBusy ? 'Dang xu ly...' : 'Dang nhap'}
            </button>
          </form>
        </AuthPanel>
      )}

      {!token && page === 'register' && (
        <AuthPanel title="Tao tai khoan" caption="Gia nhap ban co va bat dau voi Elo mac dinh cua he thong.">
          <form className="form" onSubmit={handleRegister}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Ten dang nhap
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Mat khau
              <input name="password" type="password" autoComplete="new-password" required />
            </label>
            <button className="button primary" disabled={authBusy}>
              {authBusy ? 'Dang xu ly...' : 'Dang ki'}
            </button>
          </form>
        </AuthPanel>
      )}

      {token && page === 'profile' && (
        <section className="profile-page">
          <div className="page-heading">
            <p className="eyebrow">Ho so</p>
            <h1>{user?.username ?? 'Nguoi choi'}</h1>
          </div>
          <div className="profile-grid">
            <article className="panel dark">
              <span className="metric-label">Elo hien tai</span>
              <strong className="metric">{user?.elo ?? 800}</strong>
              <span>{user?.isEmailVerified ? 'Email da xac thuc' : 'Email chua xac thuc'}</span>
            </article>
            <article className="panel">
              <span className="metric-label">Trang thai</span>
              <strong>{user?.status ?? 'ACTIVE'}</strong>
              <span>Tham gia tu {formatDate(user?.createdAt)}</span>
            </article>
          </div>

          <section className="history-section">
            <div className="section-title">
              <h2>Lich su van dau</h2>
              <button className="button tertiary small" onClick={() => loadGames().catch((error) => setNotice(error.message))}>
                Tai lai
              </button>
            </div>
            <div className="game-list">
              {games.length === 0 && <div className="empty">Chua co van dau nao duoc ghi nhan.</div>}
              {games.map((game) => (
                <article className="game-row" key={game.gameId}>
                  <div>
                    <strong>#{game.gameId}</strong>
                    <span>
                      {game.playerWhite.username} vs {game.playerBlack.username}
                    </span>
                  </div>
                  <span>{statusLabel(game.status)}</span>
                  <span>{game.gameMode?.gameModeName ?? 'Classic'}</span>
                  <span>{formatDate(game.date)}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {token && page === 'play' && (
        <section className="play-page">
          <aside className="match-panel">
            <p className="eyebrow">Tim tran</p>
            <h1>San sang cho 64 o</h1>
            <div className="mode-list">
              {gameModes.map((mode) => (
                <button
                  className={selectedMode === mode.gameModeId ? 'mode-card selected' : 'mode-card'}
                  key={mode.gameModeId}
                  onClick={() => setSelectedMode(mode.gameModeId)}
                  type="button"
                >
                  <strong>{mode.gameModeName}</strong>
                  <span>
                    {mode.time}+{mode.plusPerMove}
                  </span>
                </button>
              ))}
            </div>
            <div className="match-actions">
              {matchState === 'waiting' ? (
                <button className="button secondary" onClick={cancelFindMatch}>
                  Huy tim tran
                </button>
              ) : (
                <button className="button primary" onClick={findMatch}>
                  Tim doi thu
                </button>
              )}
              {activeGame && matchState === 'playing' && (
                <button className="button tertiary" onClick={resign}>
                  Dau hang
                </button>
              )}
            </div>
            <div className="player-stack">
              <PlayerCard label="Trang" player={activeGame?.playerWhite} active={turn === 'white'} />
              <PlayerCard label="Den" player={activeGame?.playerBlack} active={turn === 'black'} />
            </div>
          </aside>

          <section className="board-area">
            <div className="board-header">
              <div>
                <span className="badge">{myColor ? `Ban cam ${myColor === 'white' ? 'trang' : 'den'}` : 'Chua vao tran'}</span>
                <h2>{activeGame ? statusLabel(activeGame.status) : 'Ban co san sang'}</h2>
              </div>
              <span className="turn-pill">{canMove ? 'Den luot ban' : `Luot ${turn === 'white' ? 'trang' : 'den'}`}</span>
            </div>

            <div className="chess-board" aria-label="Chess board">
              {boardSquares.map((square, index) => (
                <button
                  className={[
                    'square',
                    (Math.floor(index / 8) + index) % 2 === 0 ? 'light' : 'dark-square',
                    selectedSquare === square.name ? 'selected' : '',
                  ].join(' ')}
                  key={square.name}
                  onClick={() => selectSquare(square)}
                  type="button"
                >
                  <span className="coord">{square.name}</span>
                  {square.piece && <img src={pieceImages[square.piece]} alt={square.piece} />}
                </button>
              ))}
            </div>
          </section>

          <aside className="moves-panel">
            <p className="eyebrow">Bien ban</p>
            <h2>Nuoc di</h2>
            <div className="moves-list">
              {moveLog.length === 0 && <span className="empty compact">Chua co nuoc di.</span>}
              {moveLog.map((move, index) => (
                <span key={`${move}-${index}`}>
                  {index + 1}. {move}
                </span>
              ))}
            </div>
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

function PlayerCard({ label, player, active }: { label: string; player?: User; active: boolean }) {
  return (
    <article className={active ? 'player-card active' : 'player-card'}>
      <span>{label}</span>
      <strong>{player?.username ?? 'Dang cho'}</strong>
      <small>Elo {player?.elo ?? '-'}</small>
    </article>
  )
}

function getPlayerColor(game: Game | null, user: User | null) {
  if (!game || !user) return null
  if (game.playerWhite.userId === user.userId) return 'white'
  if (game.playerBlack.userId === user.userId) return 'black'
  return null
}

function isMyPiece(piece: string, color: 'white' | 'black' | null) {
  if (!color) return false
  return color === 'white' ? piece === piece.toUpperCase() : piece === piece.toLowerCase()
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App
