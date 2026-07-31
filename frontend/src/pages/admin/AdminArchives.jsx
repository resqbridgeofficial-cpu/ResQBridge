import { useState, useEffect, useCallback } from 'react'
import { admin as adminApi } from '../../services/api'

const statusBadge = {
  pending: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  en_route: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  in_progress: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  transport_to_pwrccc: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  resolved: 'bg-green-50 text-green-700 ring-green-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
}

const PAGE_SIZE = 10

export default function AdminArchives() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [message, setMessage] = useState(null)
  const [page, setPage] = useState(1)

  const fetchArchived = useCallback(async () => {
    try {
      setLoading(true)
      const res = await adminApi.getArchivedReports()
      setReports(res.reports || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load archived reports.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchived()
  }, [fetchArchived])

  async function handleUnarchive(id) {
    setActionLoading(id)
    setMessage(null)
    try {
      await adminApi.unarchiveReport(id)
      setReports((prev) => prev.filter((r) => r._id !== id))
      setMessage({ type: 'success', text: 'Report restored from archive.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to restore report.' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Permanently delete this report? This action cannot be undone.')) return
    setActionLoading(id)
    setMessage(null)
    try {
      await adminApi.deleteReport(id)
      setReports((prev) => prev.filter((r) => r._id !== id))
      setMessage({ type: 'success', text: 'Report permanently deleted.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete report.' })
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = reports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Archived Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            {reports.length} report{reports.length !== 1 ? 's' : ''} in archive
          </p>
        </div>
        <button
          onClick={() => { fetchArchived(); setPage(1) }}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="mt-4 text-sm text-gray-400">No archived reports.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => (
            <div key={r._id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{r.animalType}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge[r.status] || 'bg-gray-50 text-gray-700'}`}>
                      {r.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span><strong>Quantity:</strong> {r.quantity ?? 1}</span>
                    <span><strong>Landmark:</strong> {r.location}</span>
                    <span><strong>Name:</strong> {r.name}</span>
                    <span><strong>Phone:</strong> {r.phone}</span>
                    {r.assignedUser && (
                      <span><strong>Assigned to:</strong> {r.assignedUser.firstName} {r.assignedUser.lastName}</span>
                    )}
                    {r.description && (
                      <span className="w-full"><strong>Description:</strong> {r.description}</span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                    <span>Created: {new Date(r.createdAt).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    <span>Archived: {new Date(r.archivedAt).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    {r.archivedByName && <span>By: {r.archivedByName}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleUnarchive(r._id)}
                    disabled={actionLoading === r._id}
                    className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Restore
                  </button>
                  <button
                    onClick={() => handleDelete(r._id)}
                    disabled={actionLoading === r._id}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>

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
        </>
      )}
    </div>
  )
}
