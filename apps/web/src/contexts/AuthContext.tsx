import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { API_URL } from '../config/api'

interface User {
  id: number
  username: string
  nomeCompleto: string
  perfil: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
  needsBootstrap: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsBootstrap, setNeedsBootstrap] = useState(false)

  useEffect(() => {
    checkBootstrap()
  }, [])

  async function checkBootstrap() {
    try {
      const response = await fetch(`${API_URL}/api/auth/bootstrap`)
      if (!response.ok) {
        setNeedsBootstrap(false)
        return
      }
      const data = await response.json()
      setNeedsBootstrap(data.hasAdmins === false)
    } catch {
      setNeedsBootstrap(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && !needsBootstrap) {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        setToken(storedToken)
        fetchUser(storedToken)
      }
    }
  }, [loading, needsBootstrap])

  async function fetchUser(authToken: string) {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem('token')
        setToken(null)
      }
    } catch {
      localStorage.removeItem('token')
      setToken(null)
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      localStorage.setItem('token', data.token)
      setToken(data.token)
      setUser(data.user)
      return true
    } catch {
      return false
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, needsBootstrap }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


