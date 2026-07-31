import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, InfoPopover, HoneypotField } from '../../components/ui'
import ReportSkeleton from './ReportSkeleton'
import fallbackSpecies from '../../data/wildlifeSpecies'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

function LocationMarker({ form, setForm }) {
  const lat = parseFloat(form.latitude)
  const lng = parseFloat(form.longitude)
  const position = isNaN(lat) || isNaN(lng) ? null : [lat, lng]

  useMapEvents({
    click(e) {
      setForm((prev) => ({ ...prev, latitude: e.latlng.lat.toString(), longitude: e.latlng.lng.toString() }))
    },
  })

  if (!position) return null

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const { lat, lng } = e.target.getLatLng()
          setForm((prev) => ({ ...prev, latitude: lat.toString(), longitude: lng.toString() }))
        },
      }}
    />
  )
}

function MapCentered({ form, locateTrigger }) {
  const lat = parseFloat(form.latitude)
  const lng = parseFloat(form.longitude)
  const position = isNaN(lat) || isNaN(lng) ? null : [lat, lng]

  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, 16)
  }, [map, locateTrigger])

  return null
}

const API_BASE = '/api/v1'

const REPORT_INFO = {
  wildlife_sighting: { label: 'Wildlife Sighting', description: 'Use this report type to report the observation of wildlife in any location. Whether the animal is healthy, injured, sick, or trapped, select its condition using the Wildlife Condition field.' },
  illegal_possession: { label: 'Illegal Wildlife Possession', description: 'Report suspected cases of individuals keeping, transporting, selling, or possessing wildlife without proper authorization or permits.' },
  human_wildlife_conflict: { label: 'Human–Wildlife Conflict', description: 'Report incidents where wildlife poses a threat to people or property, or where people are threatening or harming wildlife.' },
}

export default function Report() {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category: '',
    animalType: '',
    wildlifeCondition: '',
    quantity: '',
    location: '',
    description: '',
    latitude: '',
    longitude: '',
  })
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [locateTrigger, setLocateTrigger] = useState(0)
  const [speciesOpen, setSpeciesOpen] = useState(false)
  const [speciesQuery, setSpeciesQuery] = useState('')
  const speciesRef = useRef(null)
  const searchRef = useRef(null)
  const [wildlifeSpecies, setWildlifeSpecies] = useState(null)
  const [selectedSpecies, setSelectedSpecies] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [tosAccepted, setTosAccepted] = useState(false)
  const [showTosModal, setShowTosModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [tosScrolledToBottom, setTosScrolledToBottom] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const tosContentRef = useRef(null)
  useEffect(() => {
    if (form.latitude && form.longitude) {
      setFieldErrors((prev) => ({ ...prev, gps: '' }))
    }
  }, [form.latitude, form.longitude])
  useEffect(() => {
    if (showTosModal) {
      document.body.style.overflow = 'hidden'
    }
    return () => { document.body.style.overflow = '' }
  }, [showTosModal])
  useEffect(() => {
    fetch(`${API_BASE}/landing-config`)
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.wildlifeGuide?.length) setWildlifeSpecies(d.config.wildlifeGuide)
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!speciesOpen) return
    function handleClick(e) {
      if (speciesRef.current && !speciesRef.current.contains(e.target)) {
        setSpeciesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [speciesOpen])
  useEffect(() => {
    if (speciesOpen) searchRef.current?.focus()
  }, [speciesOpen])
  function update(field) {
    return (e) => {
      setForm({ ...form, [field]: e.target.value })
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          const max = 1080
          if (w > max) { h = h * (max / w); w = max }
          if (h > max) { w = w * (max / h); h = max }
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.7)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleImages(e) {
    const files = Array.from(e.target.files || [])
    const remaining = 5 - imageFiles.length
    const selected = files.slice(0, remaining)
    const compressed = await Promise.all(selected.map(compressImage))
    setImageFiles((prev) => [...prev, ...compressed])
    setImagePreviews((prev) => [...prev, ...selected.map((f) => URL.createObjectURL(f))])
    setFieldErrors((prev) => ({ ...prev, images: '' }))
  }

  function removeImage(index) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({ ...prev, latitude: pos.coords.latitude.toString(), longitude: pos.coords.longitude.toString() }))
        setGettingLocation(false)
        setLocateTrigger((c) => c + 1)
      },
      () => {
        setError('Could not get your location. Please allow location access and try again.')
        setGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  function validateRequiredFields() {
    const errors = {}
    if (!form.phone || form.phone.length !== 10 || form.phone[0] !== '9') errors.phone = true
    if (!form.category) errors.category = true
    if (!form.animalType) errors.animalType = true
    if (!form.wildlifeCondition) errors.wildlifeCondition = true
    if (!form.location) errors.location = true
    if (!form.latitude || !form.longitude) errors.gps = true
    if (!form.description) errors.description = true
    if (!form.quantity) errors.quantity = true
    if (imageFiles.length === 0) errors.images = true
    return errors
  }

  const FIELD_IDS = { phone: 'field-phone', category: 'field-category', animalType: 'field-animalType', wildlifeCondition: 'field-wildlifeCondition', quantity: 'field-quantity', location: 'field-location', gps: 'field-gps', description: 'field-description', images: 'field-images' }

  function scrollToField(id) {
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  function handlePreSubmit() {
    const errors = validateRequiredFields()
    setFieldErrors(errors)
    const keys = Object.keys(errors)
    if (keys.length > 0) {
      setError('Please fill in all required fields.')
      scrollToField(FIELD_IDS[keys[0]])
      return
    }

    if (!tosAccepted) {
      setShowTosModal(true)
      setTosScrolledToBottom(false)
    } else {
      setShowConfirmModal(true)
    }
  }

  function handleTosScroll() {
    const el = tosContentRef.current
    if (el) {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 5) {
        setTosScrolledToBottom(true)
      }
    }
  }

  async function doSubmit() {
    setShowConfirmModal(false)
    await handleSubmit()
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setError('')
    setPhoneError('')
    const phone = form.phone
    if (!phone || phone.length !== 10) {
      setError('Contact phone must be exactly 10 digits.')
      return
    }
    if (phone[0] !== '9') {
      setError('Contact phone must start with 9.')
      return
    }
    if (imageFiles.length === 0) {
      setError('Please upload at least one supporting photo.')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name)
      fd.append('phone', form.phone ? '+63' + form.phone : '')
      fd.append('category', form.category)
      fd.append('animalType', form.animalType)
      fd.append('wildlifeCondition', form.wildlifeCondition)
      fd.append('quantity', form.quantity)
      fd.append('location', form.location)
      fd.append('description', form.description)
      fd.append('latitude', form.latitude)
      fd.append('longitude', form.longitude)
      imageFiles.forEach((f) => fd.append('images', f))

      const res = await fetch(`${API_BASE}/report`, {
        method: 'POST',
        body: fd,
      })
      const body = await res.text()
      if (!res.ok) {
        let msg
        try { msg = JSON.parse(body).message } catch { msg = body || `Server returned ${res.status}` }
        throw new Error(msg)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ReportSkeleton />

  if (submitted) {
    return (
      <div className="flex flex-1 items-center justify-center bg-green-50 px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Report Submitted</h1>
          <p className="mt-3 text-sm text-gray-500">
            Thank you. Your report has been received and our team will follow up shortly.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={() => navigate('/')}>Back to Home</Button>
            <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: '', phone: '', category: '', animalType: '', wildlifeCondition: '', quantity: '', location: '', description: '', latitude: '', longitude: '' }); setSelectedSpecies(null); setImageFiles([]); setImagePreviews([]); if (fileRef.current) fileRef.current.value = '' }}>
              Submit Another
            </Button>
              </div>
            </div>
          </div>

    )
  }

  return (
    <div className="flex-1 bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Report an Animal</h1>
          <p className="mt-2 text-sm text-gray-500">
            Report a wildlife sighting, animal in distress, or rescue emergency.
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6 rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <HoneypotField />
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Your Name <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={form.name}
                onChange={update('name')}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Phone <InfoPopover>Your contact number will only be used by authorized personnel to verify your report and coordinate the appropriate response.</InfoPopover>
              </label>
              <div className="mt-1.5 flex" id="field-phone">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600">+63</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onBeforeInput={(e) => { if (e.data && /\D/.test(e.data)) e.preventDefault() }}
                  onPaste={(e) => {
                    const text = (e.clipboardData || window.clipboardData).getData('text')
                    if (text && /\D/.test(text)) e.preventDefault()
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                    setForm((prev) => ({ ...prev, phone: val }))
                    setFieldErrors((prev) => ({ ...prev, phone: '' }))
                    if (val.length > 0 && val[0] !== '9') {
                      setPhoneError('Number must start with 9')
                    } else if (val.length > 0 && val.length < 10) {
                      setPhoneError('Number must be exactly 10 digits')
                    } else {
                      setPhoneError('')
                    }
                  }}
                  className={`block w-full rounded-r-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                    fieldErrors.phone
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                  placeholder="9XX XXX XXXX"
                  required
                />
              </div>
              {phoneError && <p className="mt-1 text-xs text-red-500">{phoneError}</p>}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Report Type
                {form.category && <InfoPopover>
                  <div>
                    <p className="font-semibold">{REPORT_INFO[form.category]?.label}</p>
                    <p className="mt-1 text-gray-300">{REPORT_INFO[form.category]?.description}</p>
                  </div>
                </InfoPopover>}
              </label>
              <select
                id="field-category"
                value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value })
                  setFieldErrors((prev) => ({ ...prev, category: '' }))
                }}
                className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                  fieldErrors.category
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                }`}
                required
              >
                <option value="" disabled className="text-gray-400">Select report type</option>
              <option value="wildlife_sighting">Wildlife Sighting</option>
              <option value="illegal_possession">Illegal Wildlife Possession</option>
                <option value="human_wildlife_conflict">Human–Wildlife Conflict</option>
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">
                Species <InfoPopover>
                  <p className="font-semibold">Species</p>
                  <p className="mt-1 text-gray-300">Search and select the wildlife species from the Wildlife Guide. The list is automatically loaded from the Wildlife Guide database. If you are unable to identify the species, select Unknown Species.</p>
                </InfoPopover>
              </label>
              <div className="relative mt-1.5" ref={speciesRef} id="field-animalType">
                <input type="hidden" name="animalType" value={form.animalType} required />
                <button
                  type="button"
                  onClick={() => { setSpeciesOpen((o) => !o); if (!speciesOpen) { setSpeciesQuery(''); setFieldErrors((prev) => ({ ...prev, animalType: '' })) } }}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                    fieldErrors.animalType
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
                  }`}
                >
                  <span className={form.animalType ? '' : 'text-gray-400'}>{form.animalType || 'Select species'}</span>
                  <svg className={`h-4 w-4 text-gray-400 transition ${speciesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {speciesOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="border-b border-gray-100 p-2">
                      <input
                        ref={searchRef}
                        type="text"
                        value={speciesQuery}
                        onChange={(e) => setSpeciesQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                        placeholder="Search species..."
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {((wildlifeSpecies || fallbackSpecies).filter((s) => !speciesQuery || s.name.toLowerCase().includes(speciesQuery.toLowerCase()))).map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onMouseDown={() => { setForm((prev) => ({ ...prev, animalType: s.name })); setSelectedSpecies(s); setSpeciesQuery(''); setSpeciesOpen(false); setFieldErrors((prev) => ({ ...prev, animalType: '' })) }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50"
                        >
                          {s.images?.[0] && (
                            <img src={s.images[0]} alt="" className="h-6 w-6 rounded-full object-cover" />
                          )}
                          <span>{s.name}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onMouseDown={() => { setForm((prev) => ({ ...prev, animalType: 'Unknown Species' })); setSelectedSpecies(null); setSpeciesQuery(''); setSpeciesOpen(false); setFieldErrors((prev) => ({ ...prev, animalType: '' })) }}
                        className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-500 italic hover:bg-green-50"
                      >
                        Unknown Species
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedSpecies && (
            <div>
              <p className="mb-1.5 text-xs text-gray-400">Click the card to confirm if that is the animal you are reporting.</p>
              <button type="button" onClick={() => selectedSpecies.images?.[0] ? setPreviewUrl(selectedSpecies.images[0]) : null} className="w-full rounded-xl border border-green-200 bg-green-50 p-4 text-left transition-colors hover:bg-green-100">
              <div className="flex gap-4">
                {selectedSpecies.images?.[0] ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                    <img src={selectedSpecies.images[0]} alt={selectedSpecies.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-gradient-to-br from-green-100 to-emerald-50" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{selectedSpecies.name}</h3>
                  {selectedSpecies.scientificName && <p className="text-xs italic text-gray-400">{selectedSpecies.scientificName}</p>}
                  {selectedSpecies.habitat && <p className="mt-1 text-xs text-gray-500">{selectedSpecies.habitat}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {selectedSpecies.status && (
                      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">{selectedSpecies.status}</span>
                    )}
                    {selectedSpecies.activeStatus && (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">{selectedSpecies.activeStatus}</span>
                    )}
                    {selectedSpecies.hazard && selectedSpecies.hazard !== 'None' && (
                      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{selectedSpecies.hazard}</span>
                    )}
                  </div>
                </div>
              </div>
              {selectedSpecies.note && (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{selectedSpecies.note}</p>
              )}
            </button>
            </div>
          )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Animals
          </label>
          <input
            id="field-quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={(e) => {
              const val = e.target.value
              setForm({ ...form, quantity: val === '' ? '' : Math.max(1, parseInt(val) || 1).toString() })
              setFieldErrors((prev) => ({ ...prev, quantity: '' }))
            }}
            placeholder="Enter number of animals"
            className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:ring-2 ${
              !form.quantity ? 'text-gray-400' : 'text-gray-900'
            } ${
              fieldErrors.quantity
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Wildlife Condition <InfoPopover>
                <p className="font-semibold">Wildlife Condition</p>
                <p className="mt-1 text-gray-300">Select the condition that best describes the wildlife at the time of reporting. This helps responders assess the situation and determine the appropriate response.</p>
              </InfoPopover>
            </label>
            <select
              id="field-wildlifeCondition"
              value={form.wildlifeCondition}
              onChange={(e) => {
                setForm({ ...form, wildlifeCondition: e.target.value })
                setFieldErrors((prev) => ({ ...prev, wildlifeCondition: '' }))
              }}
              className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                fieldErrors.wildlifeCondition
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
              }`}
              required
            >
              <option value="">Select condition</option>
              <option value="Healthy">Healthy</option>
              <option value="Injured">Injured</option>
              <option value="Sick">Sick</option>
              <option value="Trapped">Trapped</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>
        </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nearest Landmark <InfoPopover>
                <p className="font-semibold">Nearest Landmark</p>
                <p className="mt-1 text-gray-300">Providing a nearby landmark helps responders locate the reported wildlife more quickly and accurately, especially if GPS accuracy is limited.</p>
              </InfoPopover>
            </label>
            <input
              id="field-location"
              type="text"
              value={form.location}
              onChange={(e) => {
                setForm({ ...form, location: e.target.value })
                setFieldErrors((prev) => ({ ...prev, location: '' }))
              }}
              className={`mt-1.5 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                fieldErrors.location
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
              }`}
              placeholder="Near Barangay Hall, beside the elementary school."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              GPS Location <InfoPopover position="top">
                <p className="font-semibold">GPS Location</p>
                <p className="mt-1 text-gray-300">Your current GPS location is required to help responders accurately locate the reported wildlife. After retrieving your location, verify the marker on the map and adjust it if necessary before submitting your report.</p>
              </InfoPopover>
            </label>
            <div className={`mt-1.5 space-y-3 ${fieldErrors.gps ? 'rounded-lg border border-red-400 p-3' : ''}`} id="field-gps">
              <input type="hidden" name="latitude" value={form.latitude} required />
              <input type="hidden" name="longitude" value={form.longitude} required />
              <button
                type="button"
                onClick={getLocation}
                disabled={gettingLocation}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition hover:border-green-500 hover:text-green-600 disabled:opacity-50"
              >
                {gettingLocation ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                ) : (
                  <span className="text-xs">📍</span>
                )}
                {gettingLocation ? 'Getting location...' : 'Get Current Location'}
              </button>
              <div className="relative h-56 overflow-hidden rounded-lg border border-gray-200" style={{ isolation: 'isolate' }}>
                <MapContainer
                  center={form.latitude && form.longitude ? [parseFloat(form.latitude), parseFloat(form.longitude)] : [9.967, 118.783]}
                  zoom={form.latitude && form.longitude ? 16 : 7}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker form={form} setForm={setForm} />
                  <MapCentered form={form} locateTrigger={locateTrigger} />
                </MapContainer>
                {!form.latitude && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-lg bg-white/90 px-3 py-1.5 text-sm text-gray-500 shadow-sm">
                      Click on the map to set location
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description <InfoPopover>
                <p className="font-semibold">Description</p>
                <p className="mt-1 text-gray-300">Provide a clear and detailed description of the incident. Include information such as the wildlife's behavior, condition, nearby hazards, or any other details that may assist responders in assessing and responding to the report.</p>
              </InfoPopover>
            </label>
            <textarea
              id="field-description"
              rows={4}
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value })
                setFieldErrors((prev) => ({ ...prev, description: '' }))
              }}
              className={`mt-1.5 w-full resize-y rounded-lg border px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                fieldErrors.description
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-gray-300 focus:border-green-500 focus:ring-green-500/20'
              }`}
              placeholder="Briefly describe what happened, including the wildlife's condition, behavior, surroundings, or any important details."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Supporting Photos <InfoPopover>
                <p className="font-semibold">Supporting Photos</p>
                <p className="mt-1 text-gray-300">Upload at least one clear photo of the wildlife or incident. Photos help responders verify the report, identify the wildlife species, assess its condition, and determine the most appropriate response before dispatching personnel.</p>
              </InfoPopover>
            </label>
            <p className="mt-1 text-xs text-gray-400">You can add up to 5 photos.</p>
            <div className={`mt-1.5 ${fieldErrors.images ? 'rounded-lg border border-red-400 p-3' : ''}`} id="field-images">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImages} className="hidden" />
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImages} className="hidden" />
              {imagePreviews.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative inline-block">
                      <img src={src} alt={`Preview ${i + 1}`} className="h-24 w-36 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow hover:bg-red-600"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {imageFiles.length < 5 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition hover:border-green-500 hover:text-green-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition hover:border-green-500 hover:text-green-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    Choose from Gallery
                  </button>
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={handlePreSubmit}
            isLoading={submitting}
            size="lg"
            className="w-full"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </form>
      </div>

      {showTosModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowTosModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Terms of Service</h2>
              <button
                onClick={() => setShowTosModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              ref={tosContentRef}
              onScroll={handleTosScroll}
              className="max-h-[50vh] overflow-y-auto px-6 py-4 space-y-4 text-sm leading-relaxed text-gray-600"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
                Please read the terms carefully and scroll to the bottom before you can agree.
              </div>
              <p>By submitting a report through ResQBridge, you agree to the following terms:</p>
              <h4 className="font-medium text-gray-900">1. Accuracy of Information</h4>
              <p>You confirm that all information provided in this report is accurate and truthful to the best of your knowledge.</p>
              <h4 className="font-medium text-gray-900">2. Use of Service</h4>
              <p>ResQBridge connects users with wildlife rescue teams. The platform is provided as-is for informational and emergency coordination purposes. You are responsible for ensuring that all information you provide is accurate and truthful.</p>
              <h4 className="font-medium text-gray-900">3. User Conduct</h4>
              <p>You agree not to submit false reports, misuse emergency channels, or upload harmful content.</p>
              <h4 className="font-medium text-gray-900">4. Data Privacy Consent</h4>
              <p>By providing your information, you consent to the collection and processing of your personal data. This is in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
              <h4 className="font-medium text-gray-900">5. Purpose and Use of Data</h4>
              <p>The personal data you provide, including contact information, location, and uploaded photos, will be used solely for wildlife rescue coordination, emergency response, and reporting purposes. Your data will not be used for any purpose beyond the core mission of ResQBridge without your explicit consent.</p>
              <h4 className="font-medium text-gray-900">6. Limitation of Liability</h4>
              <p>ResQBridge is not liable for any damages arising from the use or inability to use the platform, including delayed emergency responses caused by network or system failures.</p>
              <h4 className="font-medium text-gray-900">7. Changes</h4>
              <p>We reserve the right to update these terms at any time. Last updated: July 20, 2026.</p>
              {!tosScrolledToBottom && (
                <p className="sticky bottom-0 text-center text-xs text-gray-400 bg-white py-2">
                  Scroll down to read the full terms
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button variant="outline" onClick={() => setShowTosModal(false)}>
                Cancel
              </Button>
              <Button
                disabled={!tosScrolledToBottom}
                onClick={() => {
                  setTosAccepted(true)
                  setShowTosModal(false)
                  setShowConfirmModal(true)
                }}
              >
                I Agree
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Submit Animal Report"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={doSubmit}>
              Yes, Submit Report
            </Button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to submit this animal rescue report? It will be sent to rescue teams for response.
        </p>
      </Modal>

      {previewUrl && selectedSpecies && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm transition-colors hover:bg-white hover:text-gray-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {selectedSpecies.images?.length > 0 ? (
              <div>
                <div className="mb-3 aspect-square w-full overflow-hidden rounded-xl">
                  <button onClick={() => { setLightbox(previewUrl); setPreviewUrl(null) }} className="h-full w-full">
                    <img src={previewUrl} alt={selectedSpecies.name} className="h-full w-full cursor-zoom-in object-cover transition-transform hover:scale-105" />
                  </button>
                </div>
                {selectedSpecies.images.length > 1 && (
                  <div className="mb-6 flex gap-2">
                    {selectedSpecies.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPreviewUrl(img)}
                        className={`h-14 w-20 overflow-hidden rounded-lg border transition-opacity hover:opacity-80 ${
                          img === previewUrl ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200'
                        }`}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 aspect-square w-full rounded-xl bg-gradient-to-br from-green-100 to-emerald-50" />
            )}

            <h2 className="text-2xl font-bold text-gray-900">{selectedSpecies.name}</h2>
            {selectedSpecies.scientificName && (
              <p className="mt-1 text-sm italic text-gray-500">{selectedSpecies.scientificName}</p>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500">Conservation Status <InfoPopover><p className="font-semibold">Conservation Status</p><p className="mt-1 text-gray-300">PCSD classification indicating how threatened the species is in Palawan.</p></InfoPopover></p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedSpecies.status && (
                    <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-medium text-red-700">{selectedSpecies.status}</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500">Active Period <InfoPopover><p className="font-semibold">Active Period</p><p className="mt-1 text-gray-300">When this animal is most active throughout the day.</p></InfoPopover></p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedSpecies.activeStatus && (
                    <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{selectedSpecies.activeStatus}</span>
                  )}
                </div>
              </div>
              {selectedSpecies.habitat && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-500">Habitat</p>
                  <p className="mt-0.5 text-sm text-gray-700">{selectedSpecies.habitat}</p>
                </div>
              )}
              {selectedSpecies.hazard && selectedSpecies.hazard !== 'None' && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-500">Hazard <InfoPopover><p className="font-semibold">Hazard</p><p className="mt-1 text-gray-300">Know what risks this animal may pose for your safety. Venomous animals can inject venom, poisonous animals are harmful if touched or eaten, and aggressive or defensive animals may attack if provoked.</p></InfoPopover></p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">{selectedSpecies.hazard}</span>
                  </div>
                </div>
              )}
              {selectedSpecies.note && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-gray-500">Safety Note</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-700">{selectedSpecies.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-[61] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightbox}
            alt={selectedSpecies?.name || ''}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
