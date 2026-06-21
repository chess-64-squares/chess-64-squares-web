import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TOKEN_STORAGE_KEY } from '../../connect/connect'
import type { LoginResDto } from '../../dto/auth'
import type { ApiResponse } from '../../dto/response/api-response'
import type { UserResDto } from '../../dto/user'
import { authService } from '../../service/authService'
import { userService } from '../../service/userService'

interface AuthContextType {
  user: UserResDto | null
  token: string
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<ApiResponse<LoginResDto>>
  logout: () => void
  refreshProfile: () => Promise<void>
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserResDto | null>(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null)
      return
    }

    const profile = await userService.getProfile(token)
    setUser(profile)
  }, [token])

  useEffect(() => {
    refreshProfile()
      .catch(() => logout())
      .finally(() => setIsLoading(false))
  }, [logout, refreshProfile])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authService.login({ username, password })
      if (response.success && response.data?.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token)
        setToken(response.data.token)
      }
      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
      refreshProfile,
    }),
    [isLoading, login, logout, refreshProfile, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
