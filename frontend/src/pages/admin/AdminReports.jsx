import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { DoubleConfirmation, Modal, SkeletonCard } from '../../components/ui'
import { admin as adminApi } from '../../services/api'
import { MedicalIcon, StrandedIcon, SearchIcon, PawIcon, HouseIcon, ClipboardIcon } from '../../components/SvgIcons'
import ReportMap from '../rescuer/ReportMap'

const STATUS_BADGE = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  assigned: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  en_route: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 border-amber-300',
  transport_to_pwrccc: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
}

const STATUS_LABELS = {
  pending: 'Pending', assigned: 'Assigned', en_route: 'En Route',
  in_progress: 'In Progress',
  resolved: 'Successful', failed: 'Failed',
}

const CATEGORY_ICONS = {
  injury: MedicalIcon, stranded: StrandedIcon, missing: SearchIcon,
  found: PawIcon, abandoned: HouseIcon, other: ClipboardIcon,
}

const CATEGORY_LABELS = {
  injury: 'Injured / In Distress', stranded: 'Stranded', missing: 'Missing Pet / Animal',
  found: 'Found Animal', abandoned: 'Abandoned', other: 'Other',
  wildlife_sighting: 'Wildlife Sighting', illegal_possession: 'Illegal Wildlife Possession',
  human_wildlife_conflict: 'Human–Wildlife Conflict', emergency: 'Emergency',
}

export default function AdminReports({ adminPermissions }) {
  const [reports, setReports] = useState([])
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [expanded, setExpanded] = useState(null)
  const [assigningId, setAssigningId] = useState(null)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [assignTarget, setAssignTarget] = useState({})
  const [notes, setNotes] = useState({})
  const [notesLoading, setNotesLoading] = useState({})
  const location = useLocation()
  const pageSize = 10

  useEffect(() => {
    if (location.state?.reportId) {
      setExpanded(location.state.reportId)
      setTimeout(() => {
        document.getElementById(`report-${location.state.reportId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const fetchReports = useCallback(async () => {
    try {
      const data = await adminApi.getReports()
      setReports(data.reports || [])
    } catch {}
  }, [])

  useEffect(() => {
    Promise.allSettled([
      fetchReports(),
      adminApi.getUsers(),
      adminApi.getRescuerLocations(),
    ]).then(([, userRes, locRes]) => {
      if (userRes.status === 'fulfilled') setUsers((userRes.value.users || []).filter((u) => u.role === 'rescuer'))
      if (locRes.status === 'fulfilled') setLocations(locRes.value.locations || [])
    }).finally(() => setLoading(false))
  }, [fetchReports])

  useEffect(() => {
    let es
    function connect() {
      es = new EventSource('/api/v1/report/updates', { withCredentials: true })
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'report:new' || event.type === 'report:claimed' || event.type === 'report:status' || event.type === 'report:images') {
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

  function getRescuerStatus(uuid) {
    const activeReport = reports.find(
      (r) => r.assignedTo === uuid && r.status !== 'resolved' && r.status !== 'failed'
    )
    if (activeReport) {
      if (activeReport.status === 'en_route') return { label: 'En Route', color: 'text-blue-700' }
      if (activeReport.status === 'in_progress') return { label: 'In Progress', color: 'text-purple-700' }
      return { label: 'Assigned', color: 'text-indigo-700' }
    }
    const user = users.find((u) => u.uuid === uuid)
    if (user?.availability === 'busy') return { label: 'Not Available', color: 'text-red-700' }
    const loc = locations.find((l) => l.userId === uuid)
    const isActive = loc && Date.now() - new Date(loc.updatedAt).getTime() < 120000
    if (isActive) return { label: 'Active', color: 'text-green-700' }
    return { label: 'Offline', color: 'text-gray-400' }
  }

  async function handleAssign(reportId, userId) {
    if (!userId) return
    setAssigningId(reportId)
    try {
      await adminApi.assignReport(reportId, userId)
      const reportData = await adminApi.getReports()
      setReports(reportData.reports || [])
    } catch (err) {
      alert(err.message || 'Failed to assign report.')
    } finally {
      setAssigningId(null)
    }
  }

  async function fetchNotes(reportId) {
    if (notes[reportId]) return
    setNotesLoading((prev) => ({ ...prev, [reportId]: true }))
    try {
      const data = await adminApi.getReportNotes(reportId)
      setNotes((prev) => ({ ...prev, [reportId]: data.notes || [] }))
    } catch {}
    finally { setNotesLoading((prev) => ({ ...prev, [reportId]: false })) }
  }

  const filtered = reports
    .filter((r) => !filter || r.status === filter)
    .filter((r) => {
      if (!search) return true
      const q = search.toLowerCase()
      return r.name?.toLowerCase().includes(q)
        || r.location?.toLowerCase().includes(q)
        || r.animalType?.toLowerCase().includes(q)
        || r.phone?.includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Reports</h2>
          <p className="text-xs text-gray-500">
            {loading ? 'Loading...' : `${filtered.length} total`}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: '', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'assigned', label: 'Assigned' },
            { key: 'en_route', label: 'En Route' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'resolved', label: 'Successful' },
            { key: 'failed', label: 'Failed' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => { setFilter(s.key); setPage(1); setExpanded(null) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
                filter === s.key
                  ? 'bg-green-600 text-white shadow border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500 hover:text-green-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search by name, location, animal..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); setExpanded(null) }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 transition-all"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold bg-white text-gray-700 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100 transition-all"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {(!adminPermissions || adminPermissions?.reports?.execute) && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
          <span className="text-sm font-medium text-green-800">{selectedIds.size} selected</span>
          <DoubleConfirmation
            onConfirm={async () => {
              setBulkArchiving(true)
              try {
                await adminApi.bulkArchiveReports([...selectedIds])
                const reportData = await adminApi.getReports()
                setReports(reportData.reports || [])
                setSelectedIds(new Set())
              } catch (err) {
                alert(err.message || 'Failed to archive reports.')
              } finally {
                setBulkArchiving(false)
              }
            }}
            title="Archive Reports"
            message={`Are you sure you want to archive ${selectedIds.size} report${selectedIds.size > 1 ? 's' : ''}? They will be moved to the Archives.`}
            confirmText="Yes, Archive"
          >
            <button
              disabled={bulkArchiving}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {bulkArchiving ? 'Archiving...' : 'Archive Selected'}
            </button>
          </DoubleConfirmation>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="rounded-lg border border-green-300 px-4 py-1.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} lines={1} className="rounded-lg border p-3" />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-bold text-gray-900">No reports found</h3>
          <p className="mt-1 text-xs text-gray-500">
            {filter ? `No reports with status "${filter.replace('_', ' ')}"` : 'No reports have been submitted yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(!adminPermissions || adminPermissions?.reports?.execute) && (
            <div className="flex items-center gap-2 px-1 py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === paginated.length && paginated.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(paginated.map((r) => r._id)))
                    } else {
                      setSelectedIds(new Set())
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-500">Select all</span>
              </label>
            </div>
          )}
          {paginated.map((r) => {
            const statusClass = STATUS_BADGE[r.status] || STATUS_BADGE.pending
            const statusLabel = STATUS_LABELS[r.status] || r.status.replace('_', ' ')
            const isExpanded = expanded === r._id
            const isSelected = selectedIds.has(r._id)

            return (
              <div
                key={r._id}
                id={`report-${r._id}`}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? 'border-green-500 shadow bg-white'
                    : isSelected
                    ? 'border-green-400 bg-green-50/30'
                    : 'border-gray-200 bg-white hover:border-green-400 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center">
                  {(!adminPermissions || adminPermissions?.reports?.execute) && (
                    <label className="flex items-center justify-center pl-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(r._id)
                          else next.delete(r._id)
                          setSelectedIds(next)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </label>
                  )}
                    <button
                      onClick={() => {
                        const next = isExpanded ? null : r._id
                        setExpanded(next)
                        if (next) fetchNotes(next)
                      }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                  <span>{(() => { const Icon = CATEGORY_ICONS[r.category] || ClipboardIcon; return <Icon className="w-5 h-5 text-gray-600 shrink-0" />; })()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">{r.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {r.assignedUser && (
                        <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[11px] font-bold border border-indigo-300 inline-flex items-center gap-1">
                          {r.assignedUser.firstName} {r.assignedUser.lastName}
                          <span className={`text-[10px] ${getRescuerStatus(r.assignedTo).color}`}>
                            · {getRescuerStatus(r.assignedTo).label}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {CATEGORY_LABELS[r.category] || r.category} &middot; {r.animalType}{r.quantity ? ` \u00d7 ${r.quantity}` : ''} &middot; {r.location}
                    </p>
                  </div>
                  <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-all ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <div className="grid gap-3 sm:grid-cols-2 pt-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Contact</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{r.phone}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Category</p>
                        <p className="text-sm text-gray-900 mt-0.5">{CATEGORY_LABELS[r.category] || r.category}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Animal</p>
                        <p className="text-sm text-gray-900 mt-0.5">{r.animalType}{r.quantity ? ` \u00d7 ${r.quantity}` : ''}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Landmark</p>
                        <p className="text-sm text-gray-900 mt-0.5">{r.location}</p>
                      </div>
                    </div>

                    {r.description && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Description</p>
                        <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                    )}

                    {r.images && r.images.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Photos</p>
                        <div className="flex flex-wrap gap-2">
                          {r.images?.map((img, i) => (
                            <a key={`rep-${i}`} href={img} target="_blank" rel="noopener noreferrer"
                              className="group relative overflow-hidden rounded-lg border border-blue-200">
                              <img src={img} alt="" className="h-16 w-24 object-cover transition group-hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.latitude && r.longitude && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Location Map</p>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <ReportMap latitude={r.latitude} longitude={r.longitude} label={r.animalType} />
                        </div>
                      </div>
                    )}

                    {notes[r._id]?.length > 0 && (() => {
                      const postNotes = []
                      const diaryNotes = []
                      const failureNotes = []
                      const otherNotes = []
                      notes[r._id].forEach(n => {
                        if (n.content.startsWith('Post-Rescue Report:')) postNotes.push(n)
                        else if (n.content.startsWith('Rescue Diary:')) diaryNotes.push(n)
                        else if (n.content.startsWith('Failure Reason:')) failureNotes.push(n)
                        else otherNotes.push(n)
                      })

                      function parsePostReport(content) {
                        const lines = content.replace('Post-Rescue Report:\n', '').split('\n')
                        const fields = {}
                        lines.forEach(line => {
                          const idx = line.indexOf(': ')
                          if (idx > 0) {
                            const key = line.slice(0, idx).trim()
                            const val = line.slice(idx + 2).trim()
                            if (key) fields[key] = val
                          }
                        })
                        return fields
                      }

                      return (<>
                        {postNotes.map((n, i) => {
                          const fields = parsePostReport(n.content)
                          return (
                            <div key={`post-${i}`} className="mt-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Post-Rescue Report</p>
                              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
                                {fields['Condition on arrival'] && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-600">Condition on arrival</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                                      fields['Condition on arrival'] === 'Critical' ? 'bg-red-100 text-red-800' :
                                      fields['Condition on arrival'] === 'Poor' ? 'bg-orange-100 text-orange-800' :
                                      fields['Condition on arrival'] === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                                      fields['Condition on arrival'] === 'Good' ? 'bg-green-100 text-green-800' :
                                      fields['Condition on arrival'] === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{fields['Condition on arrival']}</span>
                                  </div>
                                )}
                                {fields['Actions taken'] && (
                                  <div>
                                    <span className="text-xs font-semibold text-gray-600 block">Actions taken</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {fields['Actions taken'].split(', ').map((a, ai) => (
                                        <span key={ai} className="text-xs bg-white border border-blue-300 text-blue-800 px-2 py-0.5 rounded-full">{a}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {fields['Outcome'] && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-600">Outcome</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                                      fields['Outcome'] === 'Released to wild' ? 'bg-green-100 text-green-800' :
                                      fields['Outcome'] === 'Deceased' ? 'bg-red-100 text-red-800' :
                                      fields['Outcome'] === 'Escaped' ? 'bg-orange-100 text-orange-800' :
                                      fields['Outcome'] === 'Captured' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>{fields['Outcome']}</span>
                                  </div>
                                )}
                                {fields['Number of animals'] && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-600">Number of animals</span>
                                    <span className="text-sm font-bold text-gray-900">{fields['Number of animals']}</span>
                                  </div>
                                )}
                                {fields['Environmental conditions'] && (
                                  <div>
                                    <span className="text-xs font-semibold text-gray-600 block">Environmental conditions</span>
                                    <p className="text-sm text-gray-700 mt-0.5">{fields['Environmental conditions']}</p>
                                  </div>
                                )}
                                {fields['Other responders'] && (
                                  <div>
                                    <span className="text-xs font-semibold text-gray-600 block">Other responders</span>
                                    <p className="text-sm text-gray-700 mt-0.5">{fields['Other responders']}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}

                          {r.rescuerImages && r.rescuerImages.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Rescuer Photos</p>
                              <div className="flex flex-wrap gap-2">
                                {r.rescuerImages?.map((img, i) => (
                                  <a key={`res-${i}`} href={img} target="_blank" rel="noopener noreferrer"
                                    className="group relative overflow-hidden rounded-lg border border-green-200">
                                    <img src={img} alt="" className="h-16 w-24 object-cover transition group-hover:scale-105" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                        {diaryNotes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Rescue Diary</p>
                            <div className="space-y-2">
                              {diaryNotes.map((n, i) => (
                                <div key={`diary-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                                  <p className="text-xs text-gray-500 mb-1">{n.userName} &middot; {new Date(n.createdAt).toLocaleString()}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content.replace('Rescue Diary: ', '')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {failureNotes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Failure Reason</p>
                            <div className="space-y-2">
                              {failureNotes.map((n, i) => (
                                <div key={`fail-${i}`} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                                  <p className="text-xs text-gray-500 mb-1">{n.userName} &middot; {new Date(n.createdAt).toLocaleString()}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content.replace('Failure Reason: ', '')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {otherNotes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Other Notes</p>
                            <div className="space-y-2">
                              {otherNotes.map((n, i) => (
                                <div key={`note-${i}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                  <p className="text-xs text-gray-500 mb-0.5">{n.userName} &middot; {new Date(n.createdAt).toLocaleString()}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>)
                    })()}

                    {notesLoading[r._id] && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-400">Loading notes...</p>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-0.5">Assigned Rescuer</p>
                        {r.assignedTo ? (
                          <span className="text-sm font-semibold text-gray-900">
                            {r.assignedUser?.firstName} {r.assignedUser?.lastName}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </div>
                      {r.status !== 'resolved' && r.status !== 'failed' && (
                        (!adminPermissions || adminPermissions?.reports?.write || adminPermissions?.reports?.execute) ? (
                          <select
                            disabled={assigningId === r._id}
                            value={r.assignedTo || ""}
                            onChange={(e) => {
                              const userId = e.target.value
                              if (!userId) return
                              const rescuer = users.find((u) => u.uuid === userId)
                              setAssignTarget({ reportId: r._id, userId, rescuerName: rescuer ? `${rescuer.firstName} ${rescuer.lastName}` : 'this rescuer', animalType: r.animalType })
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 focus:border-green-600 focus:outline-none disabled:opacity-50"
                          >
                            <option value="">{r.assignedTo ? 'Change rescuer...' : 'Assign rescuer...'}</option>
                            {users.map((u) => {
                              const s = getRescuerStatus(u.uuid)
                              return (
                                <option key={u.uuid} value={u.uuid}>
                                  {u.firstName} {u.lastName} — {s.label}
                                </option>
                              )
                            })}
                          </select>
                        ) : null
                      )}
                      {(!adminPermissions || adminPermissions?.reports?.execute) && (
                        <DoubleConfirmation
                          onConfirm={async () => {
                            try {
                              await adminApi.archiveReport(r._id)
                              setReports((prev) => prev.filter((x) => x._id !== r._id))
                            } catch (err) {
                              alert(err.message || 'Failed to archive report.')
                            }
                          }}
                          title="Archive Report"
                          message="Are you sure you want to archive this report? It will be moved to the Archives."
                          confirmText="Yes, Archive"
                        >
                          <button className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              Archive
                            </span>
                          </button>
                        </DoubleConfirmation>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                p === safePage
                  ? 'bg-green-600 text-white shadow border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500 hover:text-green-700'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
          </button>
        </div>
      )}

      <Modal
        isOpen={!!assignTarget.reportId}
        onClose={() => setAssignTarget({})}
        title="Assign Rescuer"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setAssignTarget({})}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await handleAssign(assignTarget.reportId, assignTarget.userId)
                setAssignTarget({})
              }}
              disabled={assigningId === assignTarget.reportId}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {assigningId === assignTarget.reportId ? 'Assigning...' : 'Confirm'}
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          Assign <span className="font-semibold text-gray-900">{assignTarget.rescuerName}</span> to the{' '}
          <span className="font-semibold text-gray-900">{assignTarget.animalType || 'report'}</span> report?
        </p>
      </Modal>
    </div>
  )
}
