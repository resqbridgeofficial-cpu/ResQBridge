import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { GoogleMap, Marker, InfoWindow, Polyline, useLoadScript } from '@react-google-maps/api'
import { admin as adminApi } from '../../services/api'

const MAP_STYLE = { width: '100%', height: '100%', borderRadius: '0.75rem' }

const STATUS_LABEL = {
  pending: 'Pending',
  assigned: 'Assigned',
  en_route: 'En Route',
  in_progress: 'In Progress',
  transport_to_pwrccc: 'Transport to PWRCCC',
  resolved: 'Successful',
  failed: 'Failed',
}

const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  en_route: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-purple-100 text-purple-800',
  transport_to_pwrccc: 'bg-indigo-100 text-indigo-800',
  resolved: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function activeAgo(updatedAt) {
  const age = Date.now() - new Date(updatedAt).getTime()
  if (age < 60000) return { label: 'Active now', online: true }
  if (age < 3600000) return { label: `${Math.floor(age / 60000)}m ago`, online: false }
  if (age < 86400000) return { label: `${Math.floor(age / 3600000)}h ago`, online: false }
  const days = Math.floor(age / 86400000)
  return { label: `${days} day${days > 1 ? 's' : ''} ago`, online: false }
}

export default function RescuerMap() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRescuer, setSelectedRescuer] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [trackingReport, setTrackingReport] = useState(null)
  const [routePath, setRoutePath] = useState([])
  const [routeInfo, setRouteInfo] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)
  const [activeRescuerIds, setActiveRescuerIds] = useState(new Set())
  const mapRef = useRef(null)

  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey })
  const mapsFailed = loadError || (isLoaded && !window.google?.maps?.version)

  const fetchLocations = useCallback(async () => {
    try {
      const data = await adminApi.getRescuerLocations()
      setLocations(data.locations || [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchLocations()
    const interval = setInterval(fetchLocations, 15000)
    return () => clearInterval(interval)
  }, [fetchLocations])

  const fetchActiveRescuers = useCallback(async () => {
    try {
      const data = await adminApi.getReports()
      const ids = new Set()
      ;(data.reports || []).forEach((r) => {
        if ((r.status === 'en_route' || r.status === 'in_progress') && r.assignedTo) {
          ids.add(r.assignedTo)
        }
      })
      setActiveRescuerIds(ids)
    } catch {}
  }, [])

  useEffect(() => {
    fetchActiveRescuers()
    const interval = setInterval(fetchActiveRescuers, 15000)
    return () => clearInterval(interval)
  }, [fetchActiveRescuers])

  const fetchAssignments = useCallback(async (rescuer) => {
    if (!rescuer?.userId) return
    setAssignLoading(true)
    try {
      const data = await adminApi.getRescuerReports(rescuer.userId)
      setAssignments((data.reports || []).filter((r) => r.status === 'en_route'))
    } catch {
      setAssignments([])
    } finally {
      setAssignLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedRescuer) {
      fetchAssignments(selectedRescuer)
    } else {
      setAssignments([])
    }
  }, [selectedRescuer, fetchAssignments])

  const handleSelect = useCallback((loc) => {
    setSelectedRescuer((prev) => {
      if (prev?.userId === loc.userId) return null
      return loc
    })
    setTrackingReport(null)
    setRoutePath([])
    setRouteInfo(null)
  }, [])

  const fetchRoute = useCallback(async (originLat, originLng, destLat, destLng) => {
    setLoadingRoute(true)
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`
      )
      if (!res.ok) return
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.length) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
        setRoutePath(coords)
        setRouteInfo({ distance: data.routes[0].distance, duration: data.routes[0].duration })
      }
    } catch {} finally {
      setLoadingRoute(false)
    }
  }, [])

  const handleTrackReport = useCallback((rep) => {
    setTrackingReport(rep)
    if (selectedRescuer && rep.latitude && rep.longitude) {
      fetchRoute(selectedRescuer.latitude, selectedRescuer.longitude, rep.latitude, rep.longitude)
    }
  }, [selectedRescuer, fetchRoute])

  useEffect(() => {
    if (!trackingReport || !selectedRescuer || !trackingReport.latitude || !trackingReport.longitude) return
    const interval = setInterval(() => {
      const current = locations.find((l) => l.userId === selectedRescuer.userId)
      if (!current) return
      fetchRoute(
        current.latitude, current.longitude,
        trackingReport.latitude, trackingReport.longitude,
      )
    }, 15000)
    return () => clearInterval(interval)
  }, [trackingReport, selectedRescuer, fetchRoute, locations])

  useEffect(() => {
    if (!selectedRescuer) {
      setTrackingReport(null)
      setRoutePath([])
      setRouteInfo(null)
    }
  }, [selectedRescuer])

  const filtered = useMemo(() => {
    const active = locations.filter((l) => activeRescuerIds.has(l.userId))
    const list = search.trim()
      ? active.filter((l) => l.userName?.toLowerCase().includes(search.toLowerCase()))
      : active
    return [...list].sort((a, b) => {
      const aOnline = Date.now() - new Date(a.updatedAt).getTime() < 60000
      const bOnline = Date.now() - new Date(b.updatedAt).getTime() < 60000
      if (aOnline !== bOnline) return aOnline ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [locations, search, activeRescuerIds])

  const enRouteCount = useMemo(
    () => activeRescuerIds.size,
    [activeRescuerIds],
  )

  const center = selectedRescuer
    ? { lat: selectedRescuer.latitude, lng: selectedRescuer.longitude }
    : locations.length > 0
      ? { lat: locations[0].latitude, lng: locations[0].longitude }
      : { lat: 14.5, lng: 121 }

  if (mapsFailed) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-red-50 border-2 border-red-200" style={{ height: '600px' }}>
        <div className="text-center">
          <p className="text-lg font-semibold text-red-700">Map service unavailable</p>
          <p className="mt-1 text-sm text-red-500">The Google Maps API key is invalid or has exceeded its quota.</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-gray-100" style={{ height: '600px' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-green-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Rescuer Map</h2>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${filtered.length} rescuer${filtered.length !== 1 ? 's' : ''} on route`}
            {enRouteCount > 0 && ` · ${enRouteCount} active now`}
          </p>
        </div>
        <button
          onClick={() => { fetchLocations(); setSelectedRescuer(null) }}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition-colors shadow"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-4 h-[640px]">
        <div className="flex-1 rounded-xl overflow-hidden border-2 border-gray-200">
          <GoogleMap
            mapContainerStyle={MAP_STYLE}
            center={center}
            zoom={selectedRescuer ? 14 : 11}
            onLoad={(map) => { mapRef.current = map }}
          >
            {locations
              .filter((l) => activeRescuerIds.has(l.userId))
              .filter((loc) => !trackingReport || loc.userId === selectedRescuer?.userId)
              .map((loc) => (
                <Marker
                  key={loc.userId}
                  position={{ lat: loc.latitude, lng: loc.longitude }}
                  title={loc.userName}
                  onClick={() => handleSelect(loc)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: selectedRescuer?.userId === loc.userId ? 14 : 10,
                    fillColor: selectedRescuer?.userId === loc.userId ? '#2563eb' : '#16a34a',
                    fillOpacity: 0.9,
                    strokeColor: '#fff',
                    strokeWeight: 4,
                  }}
                />
              ))}

            {selectedRescuer && !trackingReport && (
              <InfoWindow
                position={{ lat: selectedRescuer.latitude, lng: selectedRescuer.longitude }}
                onCloseClick={() => setSelectedRescuer(null)}
              >
                <div className="p-2 min-w-[160px]">
                  <p className="font-bold text-gray-900 text-base">{selectedRescuer.userName}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedRescuer.updatedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {selectedRescuer.animalName && (
                    <p className="text-sm text-gray-600 mt-1">
                      Tracking: {selectedRescuer.animalName}
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}

            <Polyline
              path={trackingReport ? routePath : []}
              options={{
                strokeColor: '#2563eb',
                strokeOpacity: trackingReport && routePath.length > 0 ? 0.8 : 0,
                strokeWeight: trackingReport && routePath.length > 0 ? 5 : 0,
                geodesic: true,
              }}
            />

            {trackingReport && trackingReport.latitude && trackingReport.longitude && (
              <Marker
                position={{ lat: trackingReport.latitude, lng: trackingReport.longitude }}
                title="Rescue site"
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  scaledSize: new window.google.maps.Size(40, 40),
                }}
              />
            )}
          </GoogleMap>
        </div>

        <div className="w-96 rounded-xl border-2 border-gray-200 bg-white flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search rescuer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>

          {trackingReport && (
            <div className="border-b border-gray-100 bg-blue-50 px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tracking</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {trackingReport.animalType || trackingReport.name}
                  </p>
                  {trackingReport.location && (
                    <p className="text-xs text-gray-500 mt-0.5" title={trackingReport.location}>
                      {trackingReport.location}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setTrackingReport(null); setRoutePath([]); setRouteInfo(null) }}
                  className="shrink-0 text-[11px] text-red-500 hover:text-red-700 font-medium"
                >
                  Stop
                </button>
              </div>
              {routeInfo && (
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="font-semibold text-blue-700">
                    {(routeInfo.distance / 1000).toFixed(1)} km
                  </span>
                  <span className="font-semibold text-blue-700">
                    {Math.round(routeInfo.duration / 60)} min
                  </span>
                  {loadingRoute && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  )}
                </div>
              )}
            </div>
          )}

          {selectedRescuer && !trackingReport && (
            <div className="border-b border-gray-100 bg-green-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">{selectedRescuer.userName}</p>
                <button
                  onClick={() => setSelectedRescuer(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  &times; Close
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const { label, online } = activeAgo(selectedRescuer.updatedAt)
                  return (
                    <>
                      <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm text-gray-600">{label}</span>
                    </>
                  )
                })()}
                {selectedRescuer.reportId && (
                  <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                    En Route
                  </span>
                )}
              </div>
            </div>
          )}

          {selectedRescuer && !trackingReport && assignLoading && (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">
              <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              Loading assignments...
            </div>
          )}

          {selectedRescuer && !trackingReport && !assignLoading && assignments.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-2 bg-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Assignments ({assignments.length})
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!selectedRescuer || trackingReport ? (
              filtered.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  {search ? 'No rescuers found' : 'No rescuers on route'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((loc) => {
                    const { label, online } = activeAgo(loc.updatedAt)
                    const isTracked = trackingReport && loc.userId === selectedRescuer?.userId
                    return (
                      <div
                        key={loc.userId}
                        onClick={() => handleSelect(loc)}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${isTracked ? 'bg-blue-50' : ''}`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isTracked ? 'bg-blue-200 text-blue-800' : 'bg-green-100 text-green-700'}`}>
                          {loc.userName?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'R'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">{loc.userName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs text-gray-500">{label}</span>
                          </div>
                        </div>
                        {isTracked && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                            Tracking
                          </span>
                        )}
                        {!trackingReport && loc.isTracking && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                            En Route
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : !assignLoading && (
              <div className="divide-y divide-gray-100">
                {assignments.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                    No assignments
                  </div>
                ) : (
                  assignments.map((rep) => (
                    <div key={rep._id} onClick={() => handleTrackReport(rep)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {rep.animalType || rep.name}
                          </p>
                          {rep.location && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate" title={rep.location}>
                              {rep.location}
                            </p>
                          )}
                          {rep.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{rep.description}</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[rep.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[rep.status] || rep.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                        <span>{new Date(rep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
