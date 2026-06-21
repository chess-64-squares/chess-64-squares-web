import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import './App.css'
import { AppDialog } from './component/AppDialog'
import { MainLayout } from './component/layout/MainLayout'
import { PromotionDialog, type PromotionPiece } from './component/PromotionDialog'
import { SOCKET_URL, TOKEN_STORAGE_KEY } from './connect/connect'
import { authService } from './service/authService'
import { gameService } from './service/gameService'
import { userService } from './service/userService'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { ProfilePage } from './pages/ProfilePage'
import { PlayPage } from './pages/PlayPage'
import { HistoryPage } from './pages/HistoryPage'
import type { Color, Game, GameMode, MatchState, PaginatedGames, PendingOffer, Square, ToastType, User } from './types'
import { reasonLabel, resultTitle, statusLabel } from './utils/uiFormat'

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

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const initialVerifyToken = location.pathname === '/verify-email' ? new URLSearchParams(location.search).get('token') : null
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState<User | null>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [verifyState, setVerifyState] = useState<'pending' | 'success' | 'error'>(location.pathname === '/verify-email' && !initialVerifyToken ? 'error' : 'pending')
  const [verifyMessage, setVerifyMessage] = useState(location.pathname === '/verify-email' && !initialVerifyToken ? 'Verification token is missing.' : 'Verifying your email...')

  const socketRef = useRef<Socket | null>(null)
  const dragSourceRef = useRef<string | null>(null)
  const activeGameRef = useRef<Game | null>(null)
  const pendingFindModeRef = useRef<number | null>(null)
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
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: Color } | null>(null)
  const [clockTick, setClockTick] = useState(0)

  const [gamesPage, setGamesPage] = useState<PaginatedGames>({ items: [], total: 0, page: 1, limit: 10, totalPages: 1 })
  const [historyLimit, setHistoryLimit] = useState(10)
  const [replayGame, setReplayGame] = useState<Game | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message })
  }, [])

  useEffect(() => {
    activeGameRef.current = activeGame
  }, [activeGame])

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
    if (location.pathname !== '/verify-email') return
    const params = new URLSearchParams(location.search)
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
  }, [location.pathname, location.search])

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

  const profileUsername = getProfileUsername(location.pathname)

  const loadGames = useCallback(
    async (pageNumber = 1, limit = historyLimit) => {
      if (!user && !profileUsername) return
      const data = profileUsername
        ? await gameService.getByUsername(profileUsername, pageNumber, limit, token)
        : await gameService.getByUser(user!.userId, pageNumber, limit, token)
      setGamesPage(data)
    },
    [historyLimit, profileUsername, token, user],
  )

  const restoreActiveGame = useCallback(async () => {
    if (!token || activeGame?.status === 'IN_PROGRESS') return
    const active = await gameService.getMyActiveGame(token)
    if (!active) return

    const detail = await gameService.getDetail(active.gameId, token).catch(() => active)
    setActiveGame(detail)
    setMoveLog(detail.moves?.map((move) => move.san) ?? [])
    setMoveCount(detail.moves?.length ?? 0)
    setSelectedSquare(null)
    setResultGame(null)
    setMatchState('playing')
    socketRef.current?.emit('joinGame', { gameId: detail.gameId })
  }, [activeGame?.status, token])

  useEffect(() => {
    if (!token || !location.pathname.startsWith('/history/')) return
    const gameId = Number(location.pathname.split('/').at(-1))
    if (!Number.isInteger(gameId) || gameId <= 0 || replayGame?.gameId === gameId) return
    gameService.getDetail(gameId, token)
      .then((game) => {
        setReplayGame(game)
        setReplayIndex(0)
      })
      .catch((error) => showToast('error', error instanceof Error ? error.message : 'Could not load game detail.'))
  }, [location.pathname, replayGame?.gameId, showToast, token])

  useEffect(() => {
    if (token && location.pathname.startsWith('/profile') && user) {
      if (profileUsername) {
        setProfileUser(null)
        userService.getProfileByUsername(profileUsername, token)
          .then(setProfileUser)
          .catch((error) => showToast('error', error instanceof Error ? error.message : 'Could not load profile.'))
      } else {
        setProfileUser(user)
      }
      loadGames(1, historyLimit).catch((error) => showToast('error', error.message))
    }
  }, [historyLimit, loadGames, location.pathname, profileUsername, showToast, token, user])

  useEffect(() => {
    if (!token || !user) return
    restoreActiveGame().catch((error) => showToast('error', error instanceof Error ? error.message : 'Could not restore active game.'))
  }, [restoreActiveGame, showToast, token, user])

  useEffect(() => {
    if (!token || (matchState !== 'waiting' && matchState !== 'connecting')) return

    const interval = window.setInterval(() => {
      restoreActiveGame().catch(() => undefined)
    }, 1200)

    return () => window.clearInterval(interval)
  }, [matchState, restoreActiveGame, token])

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const nextSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
    })

    nextSocket.on('connect', () => {
      showToast('success', 'Connected to the game server.')
      const queuedMode = pendingFindModeRef.current
      if (queuedMode) {
        pendingFindModeRef.current = null
        setMatchState('waiting')
        nextSocket.emit('findMatch', { gameModeId: queuedMode })
        return
      }
      if (activeGameRef.current?.status === 'IN_PROGRESS') {
        nextSocket.emit('joinGame', { gameId: activeGameRef.current.gameId })
      }
    })
    nextSocket.on('connect_error', (error) => {
      pendingFindModeRef.current = null
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
      navigate('/play')
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
    navigate('/login')
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
      navigate('/play')
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
      navigate('/login')
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
      pendingFindModeRef.current = selectedMode
      setMatchState('connecting')
      showToast('info', 'Connecting socket...')
      socket?.connect()
      return
    }
    pendingFindModeRef.current = null
    setMatchState('waiting')
    setActiveGame(null)
    setMoveLog([])
    setMoveCount(0)
    setSelectedSquare(null)
    socket.emit('findMatch', { gameModeId: selectedMode })
  }

  function cancelFindMatch() {
    pendingFindModeRef.current = null
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

    submitMove(from, target.name)
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

    submitMove(selectedSquare, square.name)
  }

  function submitMove(from: string, to: string, promotion?: PromotionPiece) {
    if (!activeGame) return
    const piece = parseFen(activeGame.fen).find((square) => square.name === from)?.piece
    if (!promotion && piece?.toLowerCase() === 'p' && isPromotionTarget(piece, to)) {
      setPendingPromotion({ from, to, color: piece === piece.toUpperCase() ? 'white' : 'black' })
      return
    }

    socketRef.current?.emit('makeMove', {
      gameId: activeGame.gameId,
      from,
      to,
      promotion,
    })
  }

  function selectPromotion(piece: PromotionPiece) {
    if (!pendingPromotion) return
    submitMove(pendingPromotion.from, pendingPromotion.to, piece)
    setPendingPromotion(null)
  }

  async function openReplay(gameId: number) {
    try {
      const game = await gameService.getDetail(gameId, token)
      setReplayGame(game)
      setReplayIndex(0)
      navigate(`/history/${game.gameId}`)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not load game detail.')
    }
  }

  return (
    <>
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      {pendingOffer && (
        <AppDialog title={pendingOffer.type === 'draw' ? 'Draw offer' : 'Resignation request'} message="Your opponent is waiting for your response.">
          <button className="button tertiary" onClick={() => respondOffer(false)}>Decline</button>
          <button className="button primary" onClick={() => respondOffer(true)}>Accept</button>
        </AppDialog>
      )}

      {confirmAction && (
        <AppDialog title={confirmTitle(confirmAction)} message={confirmMessage(confirmAction)}>
          <button className="button tertiary" onClick={() => setConfirmAction(null)}>Cancel</button>
          <button className={confirmAction === 'resign' ? 'button tertiary danger' : 'button primary'} onClick={runConfirmedAction}>
            Confirm
          </button>
        </AppDialog>
      )}

      {pendingPromotion && (
        <PromotionDialog color={pendingPromotion.color} onSelect={selectPromotion} onCancel={() => setPendingPromotion(null)} />
      )}

      {resultGame && (
        <AppDialog title={resultTitle(resultGame, user)} message={`${statusLabel(resultGame.status)} · ${reasonLabel(resultGame.reasonForEnding)}`}>
          <button className="button tertiary" onClick={() => setResultGame(null)}>Confirm</button>
          <button className="button primary"
            onClick={() => {
              setResultGame(null)
              navigate(`history/${resultGame.gameId}`)
            }}
          >View history</button>
        </AppDialog>
      )}

      <Routes>
        <Route element={<MainLayout token={token} user={user} onLogout={logout} />}>
          <Route index element={<Navigate to={token ? '/play' : '/login'} replace />} />
          <Route path="/login" element={token ? <Navigate to="/play" replace /> : <LoginPage authBusy={authBusy} onLogin={handleLogin} />} />
          <Route path="/register" element={token ? <Navigate to="/play" replace /> : <RegisterPage authBusy={authBusy} onRegister={handleRegister} />} />
          <Route path="/verify-email" element={<VerifyEmailPage state={verifyState} message={verifyMessage} onGoToLogin={() => navigate('/login')} />} />
          <Route path="/play" element={token ? (
            <PlayPage
              activeGame={activeGame}
              gameModes={gameModes}
              selectedMode={selectedMode}
              matchState={matchState}
              moveRows={moveRows}
              myColor={myColor}
              turn={turn}
              canMove={canMove}
              activeBoardSquares={activeBoardSquares}
              selectedSquare={selectedSquare}
              displayWhiteTimeMs={displayWhiteTimeMs}
              displayBlackTimeMs={displayBlackTimeMs}
              user={user}
              moveCount={moveCount}
              onSelectMode={setSelectedMode}
              onFindMatch={findMatch}
              onCancelFindMatch={cancelFindMatch}
              onRequestAction={requestAction}
              onAbortGame={abortGame}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onSquareClick={handleSquareClick}
            />
          ) : <Navigate to="/login" replace />} />
          <Route path="/profile" element={token ? (
            <ProfilePage
              user={profileUser ?? user}
              gamesPage={gamesPage}
              historyLimit={historyLimit}
              onChangeLimit={(nextLimit) => {
                setHistoryLimit(nextLimit)
                loadGames(1, nextLimit).catch((error) => showToast('error', error.message))
              }}
              onLoadGames={(pageNumber, limit) => loadGames(pageNumber, limit).catch((error) => showToast('error', error.message))}
              onOpenReplay={openReplay}
            />
          ) : <Navigate to="/login" replace />} />
          <Route path="/profile/:username" element={token ? (
            <ProfilePage
              user={profileUser}
              gamesPage={gamesPage}
              historyLimit={historyLimit}
              onChangeLimit={(nextLimit) => {
                setHistoryLimit(nextLimit)
                loadGames(1, nextLimit).catch((error) => showToast('error', error.message))
              }}
              onLoadGames={(pageNumber, limit) => loadGames(pageNumber, limit).catch((error) => showToast('error', error.message))}
              onOpenReplay={openReplay}
            />
          ) : <Navigate to="/login" replace />} />
          <Route path="/history/:gameId" element={token ? (
            <HistoryPage
              replayGame={replayGame}
              replayIndex={replayIndex}
              replaySquares={replaySquares}
              replayMoveRows={replayMoveRows}
              orientation={getPlayerColor(replayGame, user) ?? 'white'}
              user={user}
              onReplayIndexChange={(next) => {
                if (typeof next === 'function') setReplayIndex(next)
                else setReplayIndex(next)
              }}
            />
          ) : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to={token ? '/play' : '/login'} replace />} />
        </Route>
      </Routes>
    </>
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

function isPromotionTarget(piece: string, to: string) {
  return (piece === 'P' && to.endsWith('8')) || (piece === 'p' && to.endsWith('1'))
}

function getProfileUsername(pathname: string) {
  const match = pathname.match(/^\/profile\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function buildMoveRows(moves: string[]) {
  const rows: { number: number; white: string; black: string }[] = []
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({ number: index / 2 + 1, white: moves[index] ?? '', black: moves[index + 1] ?? '' })
  }
  return rows
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

export default App
