import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { rescuer as rescuerApi } from '../../services/api'
import { DoubleConfirmation } from '../../components/ui'
import { CheckIcon, XIcon } from '../../components/SvgIcons'

export default function RescuerProfile() {
  const { user, updateUser } = useAuth()
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phoneDigits, setPhoneDigits] = useState(user?.phoneNumber?.replace(/^\+63/, '') || '')
  const [organization, setOrganization] = useState(user?.organization || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSubmit() {
    setMessage(null)
    if (!phoneDigits || phoneDigits.length !== 10) {
      setMessage({ type: 'error', text: 'Phone number is required (10 digits).' })
      return
    }
    if (!organization.trim()) {
      setMessage({ type: 'error', text: 'Organization / Affiliation is required.' })
      return
    }
    setSaving(true)
    try {
      const result = await rescuerApi.updateProfile({ firstName, lastName, email, phoneNumber: '+63' + phoneDigits, organization })
      updateUser(result.user)
      setMessage({ type: 'success', text: 'Profile saved successfully!' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Could not save profile.' })
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '')

  return (
    <main className="flex-1 overflow-y-auto p-3 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="mt-1 text-lg text-gray-500">Update your personal information</p>
        </div>

        {message && (
          <div className={`mb-6 rounded-2xl px-6 py-4 text-lg font-bold flex items-center gap-3 border-2 ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border-green-300'
              : 'bg-red-100 text-red-800 border-red-300'
          }`}>
            <span>{message.type === 'success' ? <CheckIcon className="w-6 h-6" /> : <XIcon className="w-6 h-6" />}</span>
            {message.text}
          </div>
        )}

        <div className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden shadow">
          <div className="bg-amber-600 px-6 py-10 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-4xl font-bold text-white shadow-lg ring-4 ring-white/50">
              {initials || 'R'}
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">{user.firstName} {user.lastName}</h2>
            <p className="text-lg text-white/90">{user.email}</p>
            {user.organization && <p className="mt-1 text-base text-white/70">{user.organization}</p>}
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="p-6 md:p-8 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-300 px-5 py-3.5 text-lg focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-gray-700 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-300 px-5 py-3.5 text-lg focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-100 transition-all"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Phone Number</p>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border-2 border-r-0 border-gray-200 bg-gray-100 px-4 text-base font-bold text-gray-600">+63</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneDigits}
                  onBeforeInput={(e) => { if (e.data && /\D/.test(e.data)) e.preventDefault() }}
                  onPaste={(e) => {
                    const text = (e.clipboardData || window.clipboardData).getData('text')
                    if (text && /\D/.test(text)) e.preventDefault()
                  }}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9XX XXX XXXX"
                  className="block w-full rounded-r-xl border-2 border-gray-200 bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-900 outline-none transition-all focus:border-amber-600 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 px-5 py-3.5 text-lg focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-700 mb-1.5">Organization / Affiliation</label>
              <input
                type="text" required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. PWRCCC, BARMM, LGU"
                className="w-full rounded-xl border-2 border-gray-300 px-5 py-3.5 text-lg focus:border-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-100 transition-all"
              />
            </div>

            <div className="flex items-center justify-between border-t-2 border-gray-100 pt-6">
              <p className="text-base text-gray-600 font-semibold">
                <span className="capitalize">{user.role}</span> account
              </p>
              <DoubleConfirmation
                onConfirm={handleSubmit}
                title="Save Profile Changes"
                message="Are you sure you want to update your profile information?"
                confirmText="Yes, Save Changes"
              >
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-3.5 text-lg font-bold text-white shadow transition-all hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </DoubleConfirmation>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
