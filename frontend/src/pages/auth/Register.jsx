import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal.jsx'
import { HoneypotField } from '../../components/ui'
import { auth } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const API_BASE = '/api/v1'

const VALID_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'protonmail.com',
  'aol.com',
  'mail.com',
  'ymail.com',
  'zoho.com',
  'yandex.com',
]

export default function Register() {
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [otpEnabled, setOtpEnabled] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organization, setOrganization] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpMessage, setOtpMessage] = useState('')

  const [barangay, setBarangay] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [zipcode, setZipcode] = useState('')

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)

  function validateField(name, value) {
    switch (name) {
      case 'firstName':
        if (!value.trim()) return 'First name is required.'
        if (value.trim().length > 15) return 'First name must be at most 15 characters.'
        if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) return 'First name contains invalid characters.'
        return ''
      case 'lastName':
        if (!value.trim()) return 'Last name is required.'
        if (value.trim().length > 15) return 'Last name must be at most 15 characters.'
        if (!/^[a-zA-Z\s'-]+$/.test(value.trim())) return 'Last name contains invalid characters.'
        return ''
      case 'phone':
        if (!value) return 'Phone number is required.'
        if (value[0] !== '9') return 'Must start with 9.'
        if (value.length < 10) return 'Enter complete 10-digit number.'
        return ''
      case 'email':
        if (!value.trim()) return 'Email is required.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Invalid email format.'
        const domain = value.trim().split('@')[1]?.toLowerCase()
        if (domain && !VALID_EMAIL_DOMAINS.includes(domain)) return 'Email domain is not supported.'
        return ''
      case 'password':
        if (!value) return 'Password is required.'
        if (value.length < 8) return 'Password must be at least 8 characters.'
        return ''
      case 'confirmPassword':
        if (!value) return 'Please confirm your password.'
        if (value !== password) return 'Passwords do not match.'
        return ''
      case 'otp':
        if (value && (!/^\d{6}$/.test(value))) return 'OTP must be 6 digits.'
        return ''
      default:
        return ''
    }
  }

  function sanitizeText(val) {
    return val.replace(/<[^>]*>/g, '').trim()
  }

  function handleBlur(name) {
    return () => {
      setTouched((prev) => ({ ...prev, [name]: true }))
      const value = name === 'phone' ? phone : name === 'firstName' ? firstName : name === 'lastName' ? lastName : name === 'email' ? email : name === 'password' ? password : name === 'confirmPassword' ? confirmPassword : name === 'otp' ? otp : name === 'barangay' ? barangay : name === 'street' ? street : name === 'city' ? city : name === 'province' ? province : name === 'zipcode' ? zipcode : ''
      if (name !== 'password' && name !== 'confirmPassword') {
        const sanitized = sanitizeText(value)
        if (sanitized !== value) {
          const setters = { firstName: setFirstName, lastName: setLastName, email: setEmail, phone: setPhone, otp: setOtp, barangay: setBarangay, street: setStreet, city: setCity, province: setProvince, zipcode: setZipcode }
          if (setters[name]) setters[name](sanitized)
        }
      }
      const err = validateField(name, name === 'phone' ? value.replace(/\D/g, '') : value)
      setFieldErrors((prev) => ({ ...prev, [name]: err }))
    }
  }

  function handleInputChange(setter, name) {
    return (e) => {
      setter(e.target.value)
      if (touched[name]) {
        const err = validateField(name, name === 'phone' ? e.target.value.replace(/\D/g, '') : e.target.value)
        setFieldErrors((prev) => ({ ...prev, [name]: err }))
      }
    }
  }
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/landing-config`)
      .then((r) => r.json())
      .then((d) => setOtpEnabled(d.otpEnabled))
      .catch(() => {})
  }, [])

  async function handleSendOtp() {
    if (!email) return
    setOtpLoading(true)
    setError('')
    setOtpMessage('')
    try {
      const data = await auth.sendOtp(email)
      if (data.otpRequired === false) {
        setOtpEnabled(false)
        setOtpMessage('OTP is disabled. You can register directly.')
      } else {
        setOtpSent(true)
        setOtpMessage('OTP sent to your email.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const fields = [
      { name: 'firstName', value: firstName },
      { name: 'lastName', value: lastName },
      { name: 'phone', value: phone },
      { name: 'email', value: email },
      { name: 'password', value: password },
      { name: 'confirmPassword', value: confirmPassword },
    ]
    if (otpSent) fields.push({ name: 'otp', value: otp })

    const newErrors = {}
    fields.forEach(({ name, value }) => {
      const err = validateField(name, value)
      if (err) newErrors[name] = err
    })

    const allTouched = {}
    fields.forEach(({ name }) => { allTouched[name] = true })
    setTouched(allTouched)
    setFieldErrors(newErrors)

    if (Object.keys(newErrors).length > 0) return

    if (!agreed) {
      setError('You must agree to the Terms of Service and Privacy Policy.')
      return
    }

    setLoading(true)
    try {
      const data = await auth.register({
        firstName: sanitizeText(firstName),
        lastName: sanitizeText(lastName),
        phoneNumber: '+63' + phone,
        email: sanitizeText(email),
        password,
        confirmPassword,
        otp: otp.trim(),
        organization: organization.trim() || undefined,
      })
      login(data.token, data.user)
      navigate('/rescuer/dashboard')
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const serverErrors = {}
        err.errors.forEach((e) => {
          const map = { firstName: 'firstName', lastName: 'lastName', phoneNumber: 'phone', email: 'email', password: 'password', confirmPassword: 'confirmPassword', otp: 'otp' }
          const key = map[e.field]
          if (key) serverErrors[key] = e.message
        })
        if (Object.keys(serverErrors).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...serverErrors }))
        } else {
          setError(err.message)
        }
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-lg">
          <div className="text-center">
            <Link to="/" className="text-2xl font-bold text-green-600">ResQBridge</Link>
            <h1 className="mt-6 text-2xl font-light text-gray-900">Create an account</h1>
            <p className="mt-1 text-sm text-gray-400">Join ResQBridge and help protect Palawan wildlife</p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <HoneypotField />
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}
            {otpMessage && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">{otpMessage}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={handleInputChange(setFirstName, 'firstName')}
                  onBlur={handleBlur('firstName')}
                  className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                    touched.firstName && fieldErrors.firstName
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  placeholder="Juan"
                  maxLength={15}
                  required
                />
                {touched.firstName && fieldErrors.firstName && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={handleInputChange(setLastName, 'lastName')}
                  onBlur={handleBlur('lastName')}
                  className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                    touched.lastName && fieldErrors.lastName
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  placeholder="Dela Cruz"
                  maxLength={15}
                  required
                />
                {touched.lastName && fieldErrors.lastName && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <div className="mt-1.5 flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">+63</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onBeforeInput={(e) => { if (e.data && /\D/.test(e.data)) e.preventDefault() }}
                  onPaste={(e) => { const pasted = (e.clipboardData || window.clipboardData).getData('text'); if (/\D/.test(pasted)) e.preventDefault() }}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, phone: true }))
                    setFieldErrors((prev) => ({ ...prev, phone: validateField('phone', phone) }))
                  }}
                  className={`w-full rounded-r-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                    touched.phone && fieldErrors.phone
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  placeholder="9XX XXX XXXX"
                  required
                />
              </div>
              {phone && phone[0] !== '9' && (
                <p className="mt-1 text-xs text-amber-600">Must start with 9.</p>
              )}
              {phone && phone[0] === '9' && phone.length < 10 && (
                <p className="mt-1 text-xs text-amber-600">Enter complete 10-digit number.</p>
              )}
              {touched.phone && fieldErrors.phone && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <div className="mt-1.5 flex gap-2">
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={handleInputChange(setEmail, 'email')}
                    onBlur={handleBlur('email')}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                      touched.email && fieldErrors.email
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                    }`}
                    placeholder="you@example.com"
                    required
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
                  )}
                </div>
                {otpEnabled && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || !email}
                    className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
                  >
                    {otpLoading ? 'Sending...' : otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                )}
              </div>
            </div>

            {otpSent && otpEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={handleInputChange(setOtp, 'otp')}
                  onBlur={handleBlur('otp')}
                  className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                    touched.otp && fieldErrors.otp
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  placeholder="6-digit code"
                  required
                  maxLength={6}
                />
                {touched.otp && fieldErrors.otp && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.otp}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handleInputChange(setPassword, 'password')}
                    onBlur={handleBlur('password')}
                    className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                      touched.password && fieldErrors.password
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                    }`}
                    placeholder="Min. 8 characters"
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
                {password.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-2">
                      {password.length >= 8 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          At least 8 characters
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          At least 8 characters
                        </span>
                      )}
                      {/[a-zA-Z]/.test(password) && /\d/.test(password) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          Letters & numbers
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Letters & numbers
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {[1, 2].map((step) => {
                        const filled = step === 1 ? password.length >= 8 : (/[a-zA-Z]/.test(password) && /\d/.test(password))
                        return (
                          <div
                            key={step}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              filled ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative mt-1.5">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={handleInputChange(setConfirmPassword, 'confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    className={`w-full rounded-lg border px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 ${
                      touched.confirmPassword && fieldErrors.confirmPassword
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                    }`}
                    placeholder="Repeat password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
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
                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Organization / Affiliation</label>
              <input
                type="text" required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. PWRCCC, BARMM, LGU"
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-gray-700">Address</legend>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Barangay</label>
                  <input
                    list="barangay-list"
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    onBlur={() => setBarangay((v) => sanitizeText(v))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Type to search..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Street</label>
                  <input
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    onBlur={() => setStreet((v) => sanitizeText(v))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Street"
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-500">City</label>
                  <input
                    list="city-list"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={() => setCity((v) => sanitizeText(v))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Type to search..."
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-500">Province</label>
                  <input
                    list="province-list"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    onBlur={() => setProvince((v) => sanitizeText(v))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Type to search..."
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-500">Zipcode</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={zipcode}
                    onBeforeInput={(e) => { if (e.data && /\D/.test(e.data)) e.preventDefault() }}
                    onPaste={(e) => { const pasted = (e.clipboardData || window.clipboardData).getData('text'); if (/\D/.test(pasted)) e.preventDefault() }}
                    onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onBlur={() => setZipcode((v) => v.replace(/\D/g, ''))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Zipcode"
                  />
                </div>
              </div>
            </fieldset>

            <datalist id="barangay-list">
              <option value="Irawan" />
              <option value="San Miguel" />
              <option value="Bancao-Bancao" />
              <option value="San Jose" />
              <option value="Sta. Monica" />
              <option value="Tagburos" />
              <option value="Sta. Lourdes" />
              <option value="Mabuhay" />
              <option value="Light House" />
              <option value="Mandaragat" />
              <option value="Tiniguiban" />
              <option value="San Pedro" />
              <option value="San Manuel" />
              <option value="Lucbuan" />
              <option value="Sicsican" />
              <option value="Sta. Cruz" />
              <option value="Babuyan" />
              <option value="Bagong Sikat" />
              <option value="Bagong Silang" />
              <option value="Buenavista" />
            </datalist>
            <datalist id="city-list">
              <option value="Puerto Princesa City" />
              <option value="Aborlan" />
              <option value="Narra" />
              <option value="Quezon" />
              <option value="Brooke's Point" />
              <option value="Bataraza" />
              <option value="Rizal" />
              <option value="Sofronio Española" />
              <option value="El Nido" />
              <option value="Coron" />
              <option value="Taytay" />
              <option value="Roxas" />
              <option value="San Vicente" />
              <option value="Busuanga" />
              <option value="Culion" />
              <option value="Linapacan" />
              <option value="Magsaysay" />
              <option value="Cagayancillo" />
              <option value="Araceli" />
              <option value="Dumaran" />
            </datalist>
            <datalist id="province-list">
              <option value="Palawan" />
            </datalist>

            <label className="flex items-start gap-2 text-sm text-gray-500">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span>
                I agree to the{' '}
                <button type="button" onClick={() => setShowTerms(true)} className="font-medium text-green-700 underline-offset-2 hover:underline">
                  Terms of Service
                </button>
                {' '}and{' '}
                <button type="button" onClick={() => setShowPrivacy(true)} className="font-medium text-green-700 underline-offset-2 hover:underline">
                  Privacy Policy
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/v1/login" className="font-medium text-green-700 underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center">
          <Link to="/" className="text-xs text-gray-400 underline-offset-2 hover:underline hover:text-gray-600">
            &larr; Back to Home
          </Link>
        </p>
      </div>

      <Modal isOpen={showTerms} onClose={() => setShowTerms(false)} title="Terms of Service" size="lg">
        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <p>By using ResQBridge, you agree to the following terms:</p>
          <h4 className="font-medium text-gray-900">1. Use of Service</h4>
          <p>ResQBridge connects users with wildlife rescue teams. The platform is provided as-is for informational and emergency coordination purposes. Always verify critical information directly with authorized rescue personnel.</p>
          <h4 className="font-medium text-gray-900">2. User Conduct</h4>
          <p>You agree not to submit false reports, misuse emergency channels, or upload harmful content. Accounts found violating these rules may be suspended.</p>
          <h4 className="font-medium text-gray-900">3. Limitation of Liability</h4>
          <p>ResQBridge is not liable for any damages arising from the use or inability to use the platform, including delayed emergency responses caused by network or system failures.</p>
          <h4 className="font-medium text-gray-900">4. Changes</h4>
          <p>We reserve the right to update these terms at any time. Users will be notified of material changes via email or platform notice.</p>
        </div>
      </Modal>

      <Modal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy" size="lg">
        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <h4 className="font-medium text-gray-900">1. Information We Collect</h4>
          <p>We collect information you provide when creating an account, submitting reports, or contacting us, including your name, email address, and location data when you enable it.</p>
          <h4 className="font-medium text-gray-900">2. How We Use Information</h4>
          <p>Your information is used to facilitate wildlife rescue coordination, improve our services, and communicate with you about your reports or inquiries. Location data is used only for mapping and routing purposes.</p>
          <h4 className="font-medium text-gray-900">3. Data Sharing</h4>
          <p>We do not sell your personal data. Information may be shared with rescue teams and partner organizations solely for emergency coordination and rehabilitation efforts.</p>
          <h4 className="font-medium text-gray-900">4. Data Security</h4>
          <p>We implement reasonable security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
          <h4 className="font-medium text-gray-900">5. Contact</h4>
          <p>For privacy-related concerns, email us at privacy@palawanwildlife.org.</p>
        </div>
      </Modal>
    </div>
  )
}
