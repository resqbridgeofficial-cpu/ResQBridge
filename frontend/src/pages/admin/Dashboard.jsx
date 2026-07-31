import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { SkeletonTable } from '../../components/ui'
import { admin as adminApi } from '../../services/api'
import NotificationBell from '../../components/admin/NotificationBell'
import AuditLogs from './AuditLogs'
import Permissions from './Permissions'
import Monitoring from './Monitoring'
import EditConfig from './EditConfig'
import SystemConfig from './SystemConfig'
import AdminReports from './AdminReports'
import AdminArchives from './AdminArchives'
import DataExport from './DataExport'
import SystemHealth from './SystemHealth'
import RescuerMap from './RescuerMap'
import AdminProfile from './Profile'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

const roleBadge = {
  admin: 'bg-blue-100 text-blue-800',
  rescuer: 'bg-amber-100 text-amber-800',
}

const roleLabels = {
  admin: 'Admin',
  rescuer: 'Rescuer',
}

const sidebarLinks = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { key: 'users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { key: 'audit', label: 'Audit Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'permissions', label: 'Permissions', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { key: 'monitoring', label: 'Monitoring', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { key: 'landingPage', label: 'Landing Page', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { key: 'wildlifeGuide', label: 'Wildlife Guide', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { key: 'systemConfig', label: 'System Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'reports', label: 'Reports', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
  { key: 'rescuerMap', label: 'Rescuer Map', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  { key: 'archive', label: 'Archives', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4' },
  { key: 'exportData', label: 'Export', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' },
  { key: 'systemHealth', label: 'System Health', icon: 'M11.42 15.17l-5.1 2.85a.98.98 0 01-1.38-1.02l.7-5.88a1 1 0 00-.3-.88L2.1 7.46a1 1 0 01.53-1.7l5.9-.85a1 1 0 00.76-.54l2.63-5.34a1 1 0 011.86 0l2.63 5.34a1 1 0 00.76.54l5.9.85a1 1 0 01.53 1.7l-4.24 4.01a1 1 0 00-.3.88l.7 5.88a.98.98 0 01-1.38 1.02l-5.1-2.85a1 1 0 00-.95 0z' },
]

const tabLabels = {
  dashboard: 'Dashboard',
  users: 'Users',
  audit: 'Audit Logs',
  permissions: 'Permissions',
  monitoring: 'Monitoring',
  landingPage: 'Landing Page',
  wildlifeGuide: 'Wildlife Guide',
  systemConfig: 'System Config',
  reports: 'Reports',
  rescuerMap: 'Rescuer Map',
  archive: 'Archives',
  exportData: 'Export',
  systemHealth: 'System Health',
  profile: 'My Profile',
}

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const { tab } = useParams()
  const activeTab = tab || 'dashboard'
  const [editSection, setEditSection] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [chartPeriod, setChartPeriod] = useState('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adminPermissions, setAdminPermissions] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [usersRes, statsRes, dashRes, permRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getStats(),
        adminApi.getDashboardData(),
        user?.role !== 'superadmin' ? adminApi.getAdminPermissions() : Promise.resolve(null),
      ])
      setUsers(usersRes.users)
      setStats(statsRes.stats)
      setDashData(dashRes)
      if (permRes?.permissions) setAdminPermissions(permRes.permissions)
    } catch (err) {
      setError(err.message || 'Failed to load admin data')
      if (err.status === 401 || err.status === 403) navigate('/v1/login')
    } finally {
      setLoading(false)
    }
  }, [navigate, user])

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/v1/login'); return }
    fetchData()
  }, [user, authLoading, navigate, fetchData])

  if (authLoading) return <LoadingScreen />
  if (loading && !users.length) {
    return <LoadingScreen />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        activeTab={activeTab}
        onTabChange={(key, section) => { navigate(`/admin/dashboard/${key}`); setEditSection(section || null) }}
        user={user}
        logout={logout}
        navigate={navigate}
        editSection={editSection}
        adminPermissions={adminPermissions}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={tabLabels[activeTab]}
          user={user}
          onRefresh={fetchData}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          navigate={navigate}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {error && (
            <div className="mb-6 animate-slideDown rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="font-semibold underline hover:no-underline">Dismiss</button>
              </div>
            </div>
          )}

          <FadeIn key={activeTab}>
            {activeTab === 'dashboard' && (
              <DashboardTab
                stats={stats}
                dashData={dashData}
                chartPeriod={chartPeriod}
                onChartPeriodChange={setChartPeriod}
                userName={user?.firstName}
              />
            )}
            {activeTab === 'users' && (
              <UsersTab
                users={users}
                currentUserUuid={user?.uuid}
                onRefresh={fetchData}
                onCreateUser={fetchData}
              />
            )}
            {activeTab === 'audit' && <AuditLogs />}
            {activeTab === 'permissions' && <Permissions />}
            {activeTab === 'monitoring' && <Monitoring />}
            {activeTab === 'landingPage' && <EditConfig section={editSection} />}
            {activeTab === 'wildlifeGuide' && <EditConfig section="wildlifeGuide" />}
  {activeTab === 'systemConfig' && <SystemConfig />}
            {activeTab === 'reports' && <AdminReports adminPermissions={adminPermissions} />}
            {activeTab === 'archive' && <AdminArchives />}
            {activeTab === 'exportData' && <DataExport />}
            {activeTab === 'systemHealth' && <SystemHealth />}
  {activeTab === 'rescuerMap' && <RescuerMap />}
            {activeTab === 'profile' && <AdminProfile />}
</FadeIn>
        </div>
      </main>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="ml-auto flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
      <div className="flex flex-1">
        <div className="hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
          <div className="border-b border-gray-100 px-4 py-5">
            <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex-1 space-y-1 px-2 py-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <div>
              <div className="h-7 w-36 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-gradient-to-br p-5">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
                <div className="border-b border-gray-100 px-6 py-4">
                  <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="p-6">
                  <div className="h-72 animate-pulse rounded-lg bg-gray-100" />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-5">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
            <SkeletonTable rows={5} cols={4} />
          </div>
        </div>
      </div>
    </div>
  )
}

function FadeIn({ children }) {
  return (
    <div className="animate-fadeIn">{children}</div>
  )
}

const configSubLinks = [
  { key: 'about', label: 'About' },
  { key: 'hero', label: 'Hero' },
  { key: 'contact', label: 'Contact' },
  { key: 'faq', label: 'FAQ' },
  { key: 'carousel', label: 'Carousel' },

  { key: 'howItWorks', label: 'How It Works' },
  { key: 'successStories', label: 'Success Stories' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'partners', label: 'Partners' },
  { key: 'location', label: 'Location' },
  { key: 'newsEvents', label: 'News & Events' },
  { key: 'trustSection', label: 'Trust' },
]

const SUPER_ONLY_KEYS = new Set(['permissions'])

function Sidebar({ collapsed, onToggle, activeTab, onTabChange, user, logout, navigate, editSection, adminPermissions }) {
  const [expanded, setExpanded] = useState('')

  const visibleLinks = sidebarLinks.filter((link) => {
    if (user?.role === 'superadmin') return true
    if (SUPER_ONLY_KEYS.has(link.key)) return false
    if (!adminPermissions) return false
    const perm = adminPermissions[link.key]
    return perm?.read === true
  })

  return (
    <aside className={`relative flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-4">
        <Link to="/" className={`flex items-center gap-2 font-bold text-green-600 ${collapsed ? 'justify-center' : ''}`}>
          <svg className="h-7 w-7 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          {!collapsed && <span className="text-lg">ResQBridge</span>}
        </Link>
        {!collapsed && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase tracking-wider">
            Admin
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {visibleLinks.map((link) => {
          const isActive = activeTab === link.key
          const isExpanded = expanded === link.key
          if (link.key === 'landingPage') {
            return (
              <div key={link.key}>
                <button
                  onClick={() => {
                    if (collapsed) { onTabChange(link.key); return }
                    setExpanded(isExpanded ? '' : link.key)
                    onTabChange(link.key)
                  }}
                  className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? link.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-green-600" />
                  )}
                  <svg className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
                  </svg>
                  {!collapsed && <span className="flex-1 truncate text-left">{link.label}</span>}
                  {!collapsed && (
                    <svg className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                {!collapsed && isExpanded && (
                  <div className="ml-6 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                    {configSubLinks.map((sub) => {
                      const isSubActive = editSection === sub.key
                      return (
                        <button
                          key={sub.key}
                          onClick={() => onTabChange('landingPage', sub.key)}
                          className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                            isSubActive
                              ? 'bg-green-50 font-medium text-green-700'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                          }`}
                        >
                          {isSubActive && (
                            <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                          )}
                          {sub.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          return (
            <button
              key={link.key}
              onClick={() => onTabChange(link.key)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              } ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? link.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-green-600" />
              )}
              <svg className={`h-5 w-5 shrink-0 transition-colors ${
                isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
              </svg>
              {!collapsed && <span className="truncate">{link.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-gray-100 px-2 py-3">
        {!collapsed && (
          <div className="mb-2 px-3 text-xs text-gray-400">
            {user?.firstName} {user?.lastName}
          </div>
        )}
        <button
          onClick={() => { logout(); navigate('/v1/login') }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title="Logout"
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-600"
      >
        <svg className={`h-3 w-3 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  )
}

function TopBar({ title, user, onRefresh, sidebarCollapsed, onToggleSidebar, navigate }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6 shadow-sm">
      <button
        onClick={onToggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 lg:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/" className="transition-colors hover:text-gray-600">Home</Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell adminApi={adminApi} />
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <div className="flex items-center gap-2.5 border-l border-gray-200 pl-3">
          <button
            onClick={() => navigate?.('/admin/dashboard/profile')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-xs font-bold text-white shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
            title="My Profile"
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </button>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {user?.firstName} {user?.lastName}
          </span>
        </div>
      </div>
    </header>
  )
}

function DashboardTab({ stats, dashData, chartPeriod, onChartPeriodChange, userName }) {
  const totalVisitors = dashData?.guestVisits?.yearly?.reduce((s, y) => s + y.count, 0) ?? 0
  const chartKey = chartPeriod === 'daily' ? 'date' : chartPeriod === 'weekly' ? 'week' : chartPeriod === 'monthly' ? 'month' : 'year'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, {userName}. Here is your overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats?.totalUsers ?? '-'} color="green" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        <StatCard label="Admins" value={stats?.roleCounts?.admin ?? '-'} color="blue" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        <StatCard label="Rescuers" value={stats?.roleCounts?.rescuer ?? '-'} color="amber" icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Unique Visitors</h3>
                <p className="text-xs text-gray-400">Unique IPs per period on the landing page</p>
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                <button
                  key={p}
                  onClick={() => onChartPeriodChange(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    chartPeriod === p
                      ? 'bg-white text-green-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === 'daily' ? 'Day' : p === 'weekly' ? 'Week' : p === 'monthly' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashData?.guestVisits?.[chartPeriod] || []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey={chartKey} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    }}
                    formatter={(value) => [value, 'Visits']}
                    labelFormatter={(label) => `${chartKey}: ${label}`}
                  />
                  <Area type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2.5} fill="url(#visitGradient)" dot={false} activeDot={{ r: 5, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="group relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm transition-all hover:shadow-md">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-amber-200/30" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold tracking-wide text-amber-600 uppercase">Rescuer Requests</p>
              </div>
              <p className="mt-3 text-3xl font-bold text-amber-700">{dashData?.rescuerCount ?? 0}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-medium text-amber-700">Week: {dashData?.rescuerWeek ?? 0}</span>
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-medium text-amber-700">Month: {dashData?.rescuerMonth ?? 0}</span>
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-medium text-amber-700">Year: {dashData?.rescuerYear ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm transition-all hover:shadow-md">
            <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-blue-200/30" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">Reports</p>
              </div>
              <p className="mt-3 text-3xl font-bold text-blue-700">{dashData?.reportCount ?? 0}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-medium text-blue-700">Week: {dashData?.reportWeek ?? 0}</span>
                <span className="rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-medium text-blue-700">Month: {dashData?.reportMonth ?? 0}</span>
                <span className="rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-medium text-blue-700">Year: {dashData?.reportYear ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                  <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Total Visitors</p>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">{totalVisitors}</p>
              <p className="mt-1 text-xs text-gray-400">All time guest visits</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{(dashData?.recentLogs || []).length} events</span>
        </div>
        <div className="h-[420px] divide-y divide-gray-100 overflow-y-auto">
          {(dashData?.recentLogs || []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">No recent activity recorded.</p>
          ) : (
            dashData?.recentLogs?.slice(0, 50).map((log) => (
              <div key={log._id} className="flex items-center gap-4 px-6 py-3.5 text-sm transition-colors hover:bg-gray-50/50">
                <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
                  log.eventType === 'guest' ? 'bg-purple-500' :
                  log.eventType === 'login' ? 'bg-emerald-500' :
                  log.eventType === 'login_attempt' ? 'bg-amber-500' :
                  log.eventType === 'logout' ? 'bg-red-500' :
                  log.eventType === 'register' ? 'bg-blue-500' :
                  log.eventType === 'role_change' ? 'bg-orange-500' :
                  'bg-gray-300'
                }`} />
                <span className="w-28 shrink-0 font-mono text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleString('en-PH', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  log.eventType === 'guest' ? 'bg-purple-50 text-purple-700' :
                  log.eventType === 'login' ? 'bg-emerald-50 text-emerald-700' :
                  log.eventType === 'login_attempt' ? 'bg-amber-50 text-amber-700' :
                  log.eventType === 'logout' ? 'bg-red-50 text-red-700' :
                  log.eventType === 'register' ? 'bg-blue-50 text-blue-700' :
                  log.eventType === 'role_change' ? 'bg-orange-50 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {log.eventType?.replace(/_/g, ' ')}
                </span>
                <span className="min-w-0 flex-1 truncate text-gray-500">{log.section || '—'}</span>
                <span className="hidden shrink-0 font-mono text-xs text-gray-400 sm:block">{log.ipAddress?.replace(/^::ffff:/, '')}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function UsersTab({ users, currentUserUuid, onRefresh, onCreateUser }) {
  const [passwordUser, setPasswordUser] = useState(null)
  const [passwordValue, setPasswordValue] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordUpdating, setPasswordUpdating] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '', organization: '' })
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [createPhoneError, setCreatePhoneError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreateUser(e) {
    e.preventDefault()
    setCreateError('')
    setCreatePhoneError('')
    const phone = createForm.phoneNumber
    if (!phone || phone.length !== 10) {
      setCreatePhoneError('Number must be exactly 10 digits')
      setCreateLoading(false)
      return
    }
    if (phone[0] !== '9') {
      setCreatePhoneError('Number must start with 9')
      setCreateLoading(false)
      return
    }
    setCreateLoading(true)
    try {
      await adminApi.createUser({ ...createForm, phoneNumber: '+63' + phone })
      setShowCreateModal(false)
      setCreateForm({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '', organization: '' })
      setCreatePhoneError('')
      onCreateUser()
    } catch (err) {
      setCreateError(err.errors?.map((e) => e.message).join(', ') || err.message || 'Failed to create user.')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">Manage all registered users and their roles.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-green-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-green-800 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Account
          </button>
          <button onClick={onRefresh} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 hover:shadow active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Organization</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const isOwn = currentUserUuid === u.uuid
              return (
                <tr key={u.uuid} className="transition-colors hover:bg-gray-50/50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-xs font-bold text-white shadow-sm">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{u.phoneNumber}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{u.organization || '—'}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge[u.role] || 'bg-gray-100 text-gray-800'}`}>
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="relative flex items-center justify-end">
                      <button
                        onClick={() => { setPasswordUser(u); setPasswordValue(''); setCurrentPassword(''); setPasswordError(''); setPasswordConfirmOpen(false) }}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm transition-all hover:bg-gray-50 active:scale-95 ${
                          isOwn ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {isOwn ? 'Change My Password' : 'Change Password'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
            <p className="mt-1 text-sm text-gray-500">
              Setting new password for <strong>{passwordUser.firstName} {passwordUser.lastName}</strong>
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setPasswordError('')
              if (passwordValue.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
              const isOwn = passwordUser.uuid === currentUserUuid
              if (isOwn && !currentPassword) { setPasswordError('Current password is required.'); return }
              setPasswordConfirmOpen(true)
            }} className="mt-4 space-y-4">
              {passwordError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{passwordError}</div>
              )}
              {passwordUser.uuid === currentUserUuid && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'} required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'} required minLength={8}
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => { setPasswordUser(null); setPasswordValue(''); setCurrentPassword(''); setPasswordError(''); setPasswordConfirmOpen(false) }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={passwordUpdating}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50">
                  {passwordUpdating ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Confirm Password Change</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to change the password for <strong>{passwordUser.firstName} {passwordUser.lastName}</strong>?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setPasswordConfirmOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setPasswordError('')
                  setPasswordUpdating(true)
                  setPasswordConfirmOpen(false)
                  try {
                    await adminApi.updatePassword(passwordUser.uuid, passwordValue, currentPassword || undefined)
                    setPasswordUser(null)
                    setPasswordValue('')
                    setCurrentPassword('')
                  } catch (err) {
                    setPasswordError(err.message || 'Failed to update password.')
                    setPasswordUpdating(false)
                  } finally {
                    setPasswordUpdating(false)
                  }
                }}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800"
              >
                {passwordUpdating ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Create Rescuer Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              {createError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{createError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text" required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text" required
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email" required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                <div className="mt-1 flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">+63</span>
                  <input
                    type="tel" required
                    inputMode="numeric"
                    value={createForm.phoneNumber}
                    onBeforeInput={(e) => { if (e.data && /\D/.test(e.data)) e.preventDefault() }}
                    onPaste={(e) => {
                      const text = (e.clipboardData || window.clipboardData).getData('text')
                      if (text && /\D/.test(text)) e.preventDefault()
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setCreateForm((prev) => ({ ...prev, phoneNumber: val }))
                      if (val.length > 0 && val[0] !== '9') {
                        setCreatePhoneError('Number must start with 9')
                      } else if (val.length > 0 && val.length < 10) {
                        setCreatePhoneError('Number must be exactly 10 digits')
                      } else {
                        setCreatePhoneError('')
                      }
                    }}
                    className="block w-full rounded-r-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="9XX XXX XXXX"
                  />
                </div>
                {createPhoneError && <p className="mt-1 text-xs text-red-500">{createPhoneError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showCreatePassword ? 'text' : 'password'} required minLength={8}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                  <button type="button" onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCreatePassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization / Affiliation</label>
                <input
                  type="text" required
                  value={createForm.organization}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, organization: e.target.value }))}
                  placeholder="e.g. PWRCCC, BARMM, LGU"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  const colorMap = {
    green: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-700', iconBg: 'bg-green-100', iconColor: 'text-green-600', ring: 'ring-green-100' },
    red: { bg: 'from-red-50 to-rose-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100', iconColor: 'text-red-600', ring: 'ring-red-100' },
    blue: { bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', ring: 'ring-blue-100' },
    amber: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', ring: 'ring-amber-100' },
  }

  const c = colorMap[color] || colorMap.green

  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${c.bg} ${c.border} p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5`}>
      <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-white/40" />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium tracking-wide text-gray-500">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold tracking-tight ${c.text}`}>{value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg} ring-1 ${c.ring}`}>
          <svg className={`h-5 w-5 ${c.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  )
}
