import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { rescuer as rescuerApi } from '../services/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const eventSourceRef = useRef(null)

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { ...toast, id }])
    setUnreadCount((prev) => prev + 1)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!user || user.role !== 'rescuer') return
    try {
      const data = await rescuerApi.getNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }, [user])

  const markAllRead = useCallback(async () => {
    try {
      await rescuerApi.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }, [])

  const markRead = useCallback(async (id) => {
    try {
      await rescuerApi.markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [user, fetchNotifications])

  useEffect(() => {
    if (!user || (user.role !== 'rescuer' && user.role !== 'admin' && user.role !== 'superadmin')) return
    const es = new EventSource('/api/v1/report/updates', { withCredentials: true })
    eventSourceRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === 'report:claimed') {
          addToast({ type: 'info', title: 'Report Claimed', message: `Report assigned to ${event.assignedByName || 'a rescuer'}`, reportId: event.reportId })
          fetchNotifications()
        } else if (event.type === 'report:status') {
          addToast({ type: 'success', title: 'Status Update', message: `Report updated to ${event.status?.replace('_', ' ')}`, reportId: event.reportId })
        }
      } catch {}
    }

    es.onerror = () => {}

    return () => es.close()
  }, [user, addToast, fetchNotifications])

  return (
    <NotificationContext.Provider value={{ toasts, notifications, unreadCount, clearToasts, markAllRead, markRead, fetchNotifications }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border-2 px-5 py-4 shadow-lg bg-white text-gray-900 animate-slide-up ${
              t.type === 'success' ? 'border-green-400' : 'border-amber-400'
            }`}
          >
            <p className="text-base font-bold">{t.title}</p>
            <p className="text-sm text-gray-600 mt-0.5">{t.message}</p>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
