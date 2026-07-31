import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef(user)

  const fetchUser = useCallback(async (keepExisting) => {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        userRef.current = data.user
        setUser(data.user)
        return data.user
      }
      if (res.status === 401) {
        userRef.current = null
        setUser(null)
        return null
      }
      return userRef.current
    } catch {
      return userRef.current
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchUser(true)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchUser])

  function handleLogin(_newToken, newUser) {
    userRef.current = newUser
    setUser(newUser)
  }

  async function logout() {
    try { await fetch('/api/v1/log/logout', { method: 'POST', credentials: 'include' }) } catch {}
    userRef.current = null
    setUser(null)
  }

  const updateUser = useCallback((updatedFields) => {
    setUser(prev => {
      const next = { ...prev, ...updatedFields }
      userRef.current = next
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login: handleLogin, logout, isAuthenticated: !!user, updateUser, fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
