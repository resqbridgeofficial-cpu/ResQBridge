import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLocationContext } from '../../context/LocationContext'
import { DoubleConfirmation, SkeletonCard, Modal } from '../../components/ui'
import { rescuer as rescuerApi } from '../../services/api'
import { CheckIcon, XIcon, CarIcon, CameraIcon, ClipboardIcon, MedicalIcon, StrandedIcon, SearchIcon, PawIcon, HouseIcon, CheckCircleIcon, XCircleIcon } from '../../components/SvgIcons'
import ReportMap from './ReportMap'

const BADGES = {
  new: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  en_route: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-300',
  transport_to_pwrccc: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
}

const BADGE_LABELS = {
  new: 'New',
  en_route: 'En Route',
  in_progress: 'In Progress',
  transport_to_pwrccc: 'Transport to PWRCCC',
  resolved: 'Successful',
  failed: 'Failed',
}

const CATEGORY_ICONS = {
  injury: MedicalIcon, stranded: StrandedIcon, missing: SearchIcon,
  found: PawIcon, abandoned: HouseIcon, other: ClipboardIcon,
}

const SPEED_KPH = 30

function haversineDistance(coords1, coords2) {
  if (!coords1 || !coords2) return null
  const R = 6371
  const dLat = ((coords2.lat - coords1.lat) * Math.PI) / 180
  const dLng = ((coords2.lng - coords1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((coords1.lat * Math.PI) / 180) *
      Math.cos((coords2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getDistanceInfo(userPos, lat, lng) {
  if (!userPos || lat == null || lng == null) return null
  const dist = haversineDistance(userPos, { lat, lng })
  if (dist == null) return null
  return { dist, min: Math.round((dist / SPEED_KPH) * 60) }
}

export default function RescuerAssignments() {
  const { user } = useAuth()
  const { userPos, requestLocation } = useLocationContext()
  const location = useLocation()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [acceptedIds, setAcceptedIds] = useState(new Set())
  const [arrivedIds, setArrivedIds] = useState(new Set())

  const [diaryText, setDiaryText] = useState({})
  const [failReason, setFailReason] = useState({})
  const [showFailInput, setShowFailInput] = useState(new Set())
  const [postReport, setPostReport] = useState({})
  const [showPostReport, setShowPostReport] = useState(new Set())
  const cameraRef = useRef(null)
  const fileRef = useRef(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [uploadedImages, setUploadedImages] = useState({})
  const [selectedReport, setSelectedReport] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [checklists, setChecklists] = useState({})

  const EQUIPMENT_ITEMS = [
    'First Aid Kit', 'Stretcher / Carrier', 'Capture Net', 'Gloves',
    'Flashlight', 'Water / Food', 'Leash / Rope', 'Phone Charger',
    'GPS Device', 'Fire Extinguisher',
  ]

  async function loadChecklist(reportId) {
    if (checklists[reportId]) return
    try {
      const data = await rescuerApi.getChecklist(reportId)
      if (data.checklist) setChecklists((prev) => ({ ...prev, [reportId]: data.checklist.items }))
    } catch {}
  }

  function toggleCheckItem(reportId, index) {
    setChecklists((prev) => {
      const items = [...(prev[reportId] || EQUIPMENT_ITEMS.map((label) => ({ label, checked: false })))]
      items[index] = { ...items[index], checked: !items[index].checked }
      rescuerApi.saveChecklist(reportId, items).catch(() => {})
      return { ...prev, [reportId]: items }
    })
  }

  const fetchReports = useCallback(() => {
    if (!user) return
    setLoading(true)
    const statusParam = filter === 'unaccepted' ? undefined : (filter || undefined)
    rescuerApi.getReports({ assignedTo: user.uuid, status: statusParam })
      .then((data) => {
        let list = data.reports || []
        if (filter === 'unaccepted') {
          list = list.filter((r) => r.status === 'assigned' || r.status === 'pending')
        }
        setReports(list)
        setError(null)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load assignments')
        setReports([])
      })
      .finally(() => setLoading(false))
  }, [user, filter])

  useEffect(() => { setPage(1); fetchReports() }, [user, filter])

  useEffect(() => {
    const reportId = location.state?.reportId
    if (!reportId || reports.length === 0) return
    const match = reports.find((r) => r._id === reportId)
    if (match) {
      setSelectedReport(match)
      loadChecklist(reportId)
      window.history.replaceState({}, document.title)
    }
  }, [location.state?.reportId, reports])

  useEffect(() => {
    let es
    function connect() {
      es = new EventSource('/api/v1/report/updates', { withCredentials: true })
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'report:claimed' || event.type === 'report:status' || event.type === 'report:images') {
            fetchReports()
          }
        } catch {}
      }
      es.onerror = () => {
        es.close()
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => { if (es) es.close() }
  }, [fetchReports])

  async function handleAccept(reportId) {
    setActionLoading(reportId)
    try {
      await rescuerApi.updateReportStatus(reportId, 'en_route')
      const next = new Set(acceptedIds)
      next.add(reportId)
      setAcceptedIds(next)
      fetchReports()
    } catch { alert('Failed to accept.') }
    finally { setActionLoading(null) }
  }

  async function handleReject(reportId) {
    setActionLoading(reportId)
    try {
      await rescuerApi.rejectAssignment(reportId)
      fetchReports()
    } catch { alert('Failed to reject.') }
    finally { setActionLoading(null) }
  }

  const OUTCOME_OPTIONS = ['Released to wild', 'Deceased', 'Escaped', 'Captured', 'Other']
  const ACTION_OPTIONS = ['First aid administered', 'Sedated']
  const CONDITION_OPTIONS = ['Critical', 'Poor', 'Fair', 'Good', 'Excellent']

  async function handleResolve(reportId) {
    const diary = diaryText[reportId] || ''
    const report = postReport[reportId] || {}
    if (!diary.trim()) {
      alert('Please write a diary entry about how you executed the rescue.')
      return
    }
    if (!report.animals && report.animals !== 0) {
      alert('Please enter the number of animals.')
      return
    }
    setActionLoading(reportId)
    try {
      await rescuerApi.addNote(reportId, `Rescue Diary: ${diary}`)
      const structured = [
        `Condition on arrival: ${report.condition || 'Not specified'}`,
        `Actions taken: ${report.actions?.length ? report.actions.join(', ') : 'None listed'}`,
        `Outcome: ${report.outcome || 'Not specified'}`,
        `Number of animals: ${report.animals}`,
        `Environmental conditions: ${report.environment || 'Not specified'}`,
        `Other responders: ${report.responders || 'None'}`,
      ]
      await rescuerApi.addNote(reportId, `Post-Rescue Report:\n${structured.join('\n')}`)
      await rescuerApi.updateReportStatus(reportId, 'resolved')
      fetchReports()
    } catch { alert('Failed to mark as success.') }
    finally { setActionLoading(null) }
  }

  async function handleFail(reportId) {
    const diary = diaryText[reportId] || ''
    const reason = failReason[reportId] || ''
    if (!diary.trim()) {
      alert('Please write a diary entry about what happened.')
      return
    }
    if (!reason.trim()) {
      alert('Please provide the reason why the rescue failed.')
      return
    }
    setActionLoading(reportId)
    try {
      await rescuerApi.addNote(reportId, `Rescue Diary: ${diary}`)
      await rescuerApi.addNote(reportId, `Failure Reason: ${reason}`)
      await rescuerApi.updateReportStatus(reportId, 'failed')
      fetchReports()
    } catch { alert('Failed to mark as failed.') }
    finally { setActionLoading(null) }
  }

  async function handleRemoveImage(reportId, imageUrl) {
    const pending = uploadedImages[reportId] || []
    const match = pending.find((u) => u.url === imageUrl)
    setUploadedImages((prev) => ({
      ...prev,
      [reportId]: prev[reportId] ? prev[reportId].filter((u) => u.url !== imageUrl) : [],
    }))
    if (match) {
      rescuerApi.removeReportImage(reportId, match.publicId).catch(() => {})
    } else {
      rescuerApi.removeReportImage(reportId, imageUrl).catch(() => {})
    }
  }

  async function handleImageUpload(reportId, file) {
    setUploadingId(reportId)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/v1/rescuer/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
    const data = await res.json()
    if (data.url) {
      const displayUrl = data.signedUrl || data.url
      const publicId = data.url
      setUploadedImages((prev) => ({
        ...prev,
        [reportId]: [...(prev[reportId] || []), { url: displayUrl, publicId }],
      }))
      rescuerApi.saveReportImages(reportId, [publicId]).catch(() => {})
    }
    } catch { alert('Failed to upload image.') }
    finally { setUploadingId(null) }
  }

  function statusBadgeKey(status) {
    if (status === 'resolved') return 'resolved'
    if (status === 'failed') return 'failed'
    if (status === 'in_progress') return 'in_progress'
    if (status === 'en_route') return 'en_route'
    if (status === 'transport_to_pwrccc') return 'transport_to_pwrccc'
    return 'new'
  }

  if (!user) return null

  const activeCount = reports.filter((r) => r.status !== 'resolved' && r.status !== 'failed').length
  const totalPages = Math.max(1, Math.ceil(reports.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedReports = reports.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <main className="flex-1 overflow-y-auto p-3 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My Assignments</h1>
            <p className="mt-1 text-lg text-gray-500">
              {loading ? 'Loading...' : `${reports.length} total - ${activeCount} active`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: '', label: 'All' },
              { key: 'unaccepted', label: 'New' },
              { key: 'en_route', label: 'En Route' },
              { key: 'in_progress', label: 'In Progress' },
              { key: 'resolved', label: 'Successful' },
              { key: 'failed', label: 'Failed' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setFilter(s.key)}
                className={`rounded-xl px-5 py-3 text-base font-bold transition-all border-2 ${
                  filter === s.key
                    ? 'bg-amber-600 text-white shadow border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-500 hover:text-amber-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-16 text-center">
            <h3 className="text-xl font-bold text-red-800">Error loading assignments</h3>
            <p className="mt-2 text-base text-red-600">{error}</p>
            <button onClick={fetchReports} className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">
              Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100">
              <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
            </div>
            <h3 className="mt-5 text-xl font-bold text-gray-900">No assignments</h3>
            <p className="mt-2 text-base text-gray-500">
              {filter === 'unaccepted' ? 'No new assignments' : filter ? `No ${filter.replace('_', ' ')} assignments` : 'No reports have been assigned to you yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Animal</th>
                    <th className="px-5 py-4">Landmark</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedReports.map((r) => {
                    const badgeKey = statusBadgeKey(r.status)
                    const badgeClass = BADGES[badgeKey] || BADGES.new
                    const badgeLabel = BADGE_LABELS[badgeKey]
                    const Icon = CATEGORY_ICONS[r.category] || ClipboardIcon

                    return (
                      <tr
                        key={r._id}
                        onClick={() => { setSelectedReport(r); loadChecklist(r._id) }}
                        className="cursor-pointer transition-colors hover:bg-amber-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-gray-500 shrink-0" />
                            <div>
                              <span className="font-semibold text-gray-900">{r.animalType}{r.quantity ? ` \u00d7 ${r.quantity}` : ''}</span>
                              <p className="text-xs text-gray-400">{r.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600 max-w-[200px] truncate">
  {r.location}
  {(() => {
    const info = getDistanceInfo(userPos, r.latitude, r.longitude)
    if (!info) return null
    return <span className="block text-xs text-gray-400">{info.dist.toFixed(1)} km · {info.min} min</span>
  })()}
</td>
                        <td className="px-5 py-4">
                          <span className={`inline-block rounded-full border-2 px-3 py-0.5 text-xs font-bold ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="block md:hidden space-y-3">
              {paginatedReports.map((r) => {
                const badgeKey = statusBadgeKey(r.status)
                const badgeClass = BADGES[badgeKey] || BADGES.new
                const badgeLabel = BADGE_LABELS[badgeKey]
                const Icon = CATEGORY_ICONS[r.category] || ClipboardIcon
                const distInfo = getDistanceInfo(userPos, r.latitude, r.longitude)

                return (
                  <div
                    key={r._id}
                    onClick={() => { setSelectedReport(r); loadChecklist(r._id) }}
                    className="rounded-xl border-2 border-gray-200 bg-white p-4 cursor-pointer transition-colors hover:border-amber-300 active:bg-amber-50"
                  >
                        <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{r.animalType}{r.quantity ? ` \u00d7 ${r.quantity}` : ''}</span>
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{r.name}</p>
                        <p className="text-sm text-gray-600 mt-1 truncate">{r.location}</p>
                        {distInfo && (
                          <p className="text-xs text-gray-400 mt-0.5">{distInfo.dist.toFixed(1)} km · {distInfo.min} min</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <Modal
              isOpen={!!selectedReport}
              onClose={() => { setSelectedReport(null); setShowFailInput(new Set()); setArrivedIds(new Set()) }}
              title={selectedReport?.name || ''}
              size="7xl"
            >
              {selectedReport && (() => {
                const r = selectedReport
                const isAccepted = acceptedIds.has(r._id)
                const badgeKey = statusBadgeKey(r.status)
                const badgeClass = BADGES[badgeKey] || BADGES.new
                const badgeLabel = BADGE_LABELS[badgeKey]

                const hasArrived = arrivedIds.has(r._id) || r.status === 'in_progress'
                const showInitial = !isAccepted && r.status !== 'en_route' && r.status !== 'in_progress' && r.status !== 'resolved' && r.status !== 'failed'
                const showEnRoute = !showInitial && !hasArrived && (isAccepted || r.status === 'en_route')
                const showPostArrival = hasArrived
                const reporterImages = r.images || []
                const rescuerSavedImages = r.rescuerImages || []
                const rescuerPendingImages = (uploadedImages[r._id] || []).map((u) => u.url)
                const allRescuerImages = [...new Set([...rescuerSavedImages, ...rescuerPendingImages])]

                const distInfo = getDistanceInfo(userPos, r.latitude, r.longitude)
                const isNearSite = distInfo && distInfo.dist <= 0.05

                return (
                  <div className="max-h-[75vh] overflow-y-auto space-y-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${badgeClass}`}>{badgeLabel}</span>
                      <span className="text-sm text-gray-500">{r.animalType}</span>
                      <span className="text-sm text-gray-400">
                        {r.location}
                        {(() => {
                          const info = getDistanceInfo(userPos, r.latitude, r.longitude)
                          if (!info) return null
                          return <> · {info.dist.toFixed(1)} km · ~{info.min} min</>
                        })()}
                      </span>
                    </div>

                    {r.description && <p className="text-gray-700">{r.description}</p>}

                    {reporterImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reporterImages.map((url, i) => (
                          <button key={`rep-${i}`} type="button" onClick={() => setPreviewImage(url)}
                            className="group relative overflow-hidden rounded-xl border-2 border-blue-200 p-0 cursor-pointer">
                            <img src={url} alt="" className="h-20 w-20 object-cover transition group-hover:scale-105" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Reporter</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{r.name}</p>
                        {r.phone && <p className="text-gray-600">{r.phone}</p>}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Category</p>
                        <p className="mt-0.5 font-semibold text-gray-900 capitalize">{r.category?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Animal</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{r.animalType}{r.quantity ? ` \u00d7 ${r.quantity}` : ''}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Landmark</p>
                        <p className="mt-0.5 font-semibold text-gray-900">{r.location}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Submitted</p>
                        <p className="mt-0.5 font-semibold text-gray-900">
                          {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {r.latitude && r.longitude && (
                      <ReportMap latitude={r.latitude} longitude={r.longitude} label={r.name} userPos={userPos} requestLocation={requestLocation} autoRoute={r.status === 'en_route'} showControls={r.status === 'en_route'} />
                    )}

                    {showInitial && (
                      <div className="flex flex-wrap gap-3 pt-2">
                        <DoubleConfirmation
                          onConfirm={() => { handleAccept(r._id); setSelectedReport(null) }}
                          title="Accept Assignment"
                          message="Are you sure you want to accept this assignment? You will be responsible for responding to this rescue request."
                          confirmText="Yes, Accept"
                        >
                          <button className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow">
                            <CheckIcon className="w-4 h-4" /> Accept
                          </button>
                        </DoubleConfirmation>
                        <DoubleConfirmation
                          onConfirm={() => { handleReject(r._id); setSelectedReport(null) }}
                          title="Reject Assignment"
                          message="Are you sure you want to reject this assignment? This will make it available for other rescuers."
                          confirmText="Yes, Reject"
                        >
                          <button className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-200 border-2 border-red-200">
                            <XIcon className="w-4 h-4" /> Reject
                          </button>
                        </DoubleConfirmation>
                      </div>
                    )}

                    {!showInitial && (
                      <>
                        {showEnRoute && (
                          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-lg font-bold text-amber-900">En Route to Rescue Site</p>
                                <p className="text-sm text-amber-700">Follow the route on the map above</p>
                              </div>
                              <button
                                onClick={async () => {
                                  setActionLoading(r._id)
                                  try {
                                    await rescuerApi.updateReportStatus(r._id, 'in_progress')
                                    const next = new Set(arrivedIds)
                                    next.add(r._id)
                                    setArrivedIds(next)
                                    fetchReports()
                                  } catch { alert('Failed to mark arrived.') }
                                  finally { setActionLoading(null) }
                                }}
                                disabled={!isNearSite || actionLoading === r._id}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-base font-bold shadow transition-all ${
                                  isNearSite
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                {actionLoading === r._id ? '...' : <><CarIcon className="w-5 h-5" /> Arrived</>}
                              </button>
                            </div>
                            {!isNearSite && distInfo && (
                              <p className="text-xs text-amber-600 font-medium">
                                You must be within 50m of the rescue site to mark as arrived
                              </p>
                            )}
                          </div>
                        )}

                        {showPostArrival && (
                          <div className="space-y-3">
                            <textarea
                              placeholder="Write your rescue diary here..."
                              value={diaryText[r._id] || ''}
                              onChange={(e) => setDiaryText({ ...diaryText, [r._id]: e.target.value })}
                              className="w-full rounded-xl border-2 border-gray-300 p-3 text-sm focus:border-amber-500 focus:outline-none"
                              rows={3}
                            />

                            {!showFailInput.has(r._id) && (
                              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 space-y-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Post-Rescue Report</p>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Condition on arrival</label>
                                  <select
                                    value={postReport[r._id]?.condition || ''}
                                    onChange={(e) => setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], condition: e.target.value } })}
                                    className="mt-1 w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none bg-white"
                                  >
                                    <option value="">Select condition</option>
                                    {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Actions taken</label>
                                  <div className="mt-1 grid grid-cols-2 gap-2">
                                    {ACTION_OPTIONS.map((a) => {
                                      const checked = postReport[r._id]?.actions?.includes(a) || false
                                      return (
                                        <label key={a} className="flex items-center gap-2 cursor-pointer">
                                          <input type="checkbox" checked={checked}
                                            onChange={() => {
                                              const actions = postReport[r._id]?.actions || []
                                              const next = checked ? actions.filter((x) => x !== a) : [...actions, a]
                                              setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], actions: next } })
                                            }}
                                            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                          />
                                          <span className="text-sm text-gray-700">{a}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Outcome</label>
                                  <select
                                    value={postReport[r._id]?.outcome || ''}
                                    onChange={(e) => setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], outcome: e.target.value } })}
                                    className="mt-1 w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none bg-white"
                                  >
                                    <option value="">Select outcome</option>
                                    {OUTCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Number of animals</label>
                                  <input type="number" min="0"
                                    value={postReport[r._id]?.animals ?? ''}
                                    onChange={(e) => setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], animals: e.target.value } })}
                                    placeholder="e.g. 3"
                                    className="mt-1 w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Environmental conditions</label>
                                  <input type="text"
                                    value={postReport[r._id]?.environment || ''}
                                    onChange={(e) => setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], environment: e.target.value } })}
                                    placeholder="e.g. Rainy, muddy, hot, night time"
                                    className="mt-1 w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="text-sm font-semibold text-gray-700">Other responders present</label>
                                  <input type="text"
                                    value={postReport[r._id]?.responders || ''}
                                    onChange={(e) => setPostReport({ ...postReport, [r._id]: { ...postReport[r._id], responders: e.target.value } })}
                                    placeholder="Names of other rescuers, organizations"
                                    className="mt-1 w-full rounded-xl border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-amber-600 focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || [])
                                  files.forEach((file) => handleImageUpload(r._id, file))
                                  e.target.value = ''
                                }}
                              />
                              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || [])
                                  files.forEach((file) => handleImageUpload(r._id, file))
                                  e.target.value = ''
                                }}
                              />
                              <button type="button" disabled={uploadingId === r._id} onClick={() => cameraRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition hover:border-green-500 hover:text-green-600 disabled:opacity-50"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                                Take Photo
                              </button>
                              <button type="button" disabled={uploadingId === r._id} onClick={() => fileRef.current?.click()}
                                className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition hover:border-green-500 hover:text-green-600 disabled:opacity-50"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                </svg>
                                Choose from Gallery
                              </button>
                            </div>
                            {uploadingId === r._id && (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Uploading...
                              </div>
                            )}
                            {allRescuerImages.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">My Photos</p>
                                <div className="flex flex-wrap gap-2">
                                  {allRescuerImages.map((url, i) => (
                                    <div key={`res-${i}`} className="relative group">
                                      <button type="button" onClick={() => setPreviewImage(url)}
                                        className="block overflow-hidden rounded-xl border-2 border-green-200 p-0 cursor-pointer">
                                        <img src={url} alt="" className="h-20 w-20 object-cover transition group-hover:scale-105" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); handleRemoveImage(r._id, url) }}
                                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <DoubleConfirmation
                                onConfirm={() => { handleResolve(r._id); setSelectedReport(null) }}
                                title="Mark as Success"
                                message="Are you sure you want to mark this assignment as successful?"
                                confirmText="Yes, Success"
                              >
                                <button disabled={actionLoading === r._id}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow disabled:opacity-50"
                                >
                                  {actionLoading === r._id ? '...' : <><CheckCircleIcon className="w-4 h-4" /> Success</>}
                                </button>
                              </DoubleConfirmation>
                              <button
                                onClick={() => {
                                  const next = new Set(showFailInput)
                                  if (next.has(r._id)) next.delete(r._id); else next.add(r._id)
                                  setShowFailInput(next)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-200 border-2 border-red-200"
                              >
                                <XCircleIcon className="w-4 h-4" /> Failed
                              </button>
                            </div>
                            {showFailInput.has(r._id) && (
                              <div className="space-y-2">
                                <textarea
                                  placeholder="Why did the rescue fail?"
                                  value={failReason[r._id] || ''}
                                  onChange={(e) => setFailReason({ ...failReason, [r._id]: e.target.value })}
                                  className="w-full rounded-xl border-2 border-red-300 p-3 text-sm focus:border-red-500 focus:outline-none"
                                  rows={2}
                                />
                                <DoubleConfirmation
                                  onConfirm={() => { handleFail(r._id); setSelectedReport(null) }}
                                  title="Mark as Failed"
                                  message="Are you sure you want to mark this assignment as failed?"
                                  confirmText="Yes, Mark Failed"
                                >
                                  <button disabled={actionLoading === r._id}
                                    className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 shadow disabled:opacity-50"
                                  >
                                    {actionLoading === r._id ? '...' : 'Confirm Failed'}
                                  </button>
                                </DoubleConfirmation>
                              </div>
                            )}
                          </div>
                        )}


                      </>
                    )}
                  </div>
                )
              })()}
            </Modal>
          </>
        )}

        {previewImage && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
            <button type="button" onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white text-2xl hover:bg-white/40 transition-colors z-10"
            >&times;</button>
            <img src={previewImage} alt="" className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2 text-base font-bold text-gray-700 hover:border-amber-500 hover:text-amber-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`rounded-xl border-2 px-4 py-2 text-base font-bold transition-colors ${
                  p === safePage
                    ? 'bg-amber-600 text-white shadow border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-500 hover:text-amber-700'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2 text-base font-bold text-gray-700 hover:border-amber-500 hover:text-amber-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
