import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { auth } from '../../services/api'
import { HoneypotField } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [ssoMessage, setSsoMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, fetchUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('sso') === 'success') {
      fetchUser().then((user) => {
        if (user) {
          login(null, user)
          redirectByRole(user.role)
        }
      })
      setSsoMessage('Signed in with Google successfully.')
    } else if (searchParams.get('error') === 'sso_failed') {
      setError('Google sign-in failed. Please try again.')
    }
  }, [])

  function redirectByRole(role) {
    if (role === 'superadmin' || role === 'admin') navigate('/admin/dashboard')
    else if (role === 'rescuer') navigate('/rescuer/dashboard')
    else navigate('/')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSsoMessage('')
    setLoading(true)

    try {
      const data = await auth.login(email.trim(), password)
      login(data.token, data.user)
      redirectByRole(data.user.role)
    } catch (err) {
      const msg = err.errors?.length
        ? err.errors.map((e) => e.message).join(', ')
        : err.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-lg">
          <div className="text-center">
            <Link to="/" className="text-2xl font-bold text-green-600">ResQBridge</Link>
            <h1 className="mt-6 text-2xl font-light text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-400">Sign in to your account</p>
          </div>

          {ssoMessage && (
            <div className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{ssoMessage}</div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <HoneypotField />
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700">Email or Phone</label>
                <input
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder=""
                  required
                  autoComplete="username"
                />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder=""
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            {error && (
              <div className="mt-4 text-center">
                <Link to="/v1/forgot-password" className="text-sm font-medium text-green-700 underline-offset-2 hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <div className="mt-6" />
        </div>
      </div>
    </div>
  )
}
