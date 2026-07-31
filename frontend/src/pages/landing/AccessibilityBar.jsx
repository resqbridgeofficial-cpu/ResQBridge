import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'resqbridge-a11y'

const defaults = {
  fontSize: 'normal',
  highContrast: false,
}

const fontSizes = [
  { key: 'normal', label: 'A', scale: '1' },
  { key: 'large', label: 'A+', scale: '1.15' },
  { key: 'xlarge', label: 'A++', scale: '1.3' },
]

export default function AccessibilityBar() {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults
    } catch {
      return defaults
    }
  })

  const applyPrefs = useCallback((p) => {
    const root = document.documentElement
    root.style.setProperty('--a11y-font-size', p.fontSize === 'normal' ? '100%' : p.fontSize === 'large' ? '115%' : '130%')
    root.classList.toggle('high-contrast', p.highContrast)
  }, [])

  useEffect(() => {
    applyPrefs(prefs)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch {}
  }, [prefs, applyPrefs])

  function update(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed left-4 top-20 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:text-emerald-600 hover:shadow-md"
        aria-label="Accessibility settings"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="fixed left-4 top-32 z-50 w-64 animate-fadeIn rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Accessibility</h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Font Size</p>
              <div className="flex gap-1">
                {fontSizes.map((fs) => (
                  <button
                    key={fs.key}
                    onClick={() => update('fontSize', fs.key)}
                    className={`flex-1 rounded-lg py-2 text-center text-xs font-semibold transition-all ${
                      prefs.fontSize === fs.key
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">High Contrast</span>
              <button
                onClick={() => update('highContrast', !prefs.highContrast)}
                className={`relative h-6 w-10 rounded-full transition-colors ${
                  prefs.highContrast ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={prefs.highContrast}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    prefs.highContrast ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
