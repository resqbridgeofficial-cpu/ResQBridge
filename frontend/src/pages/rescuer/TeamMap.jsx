import { useState, useEffect, useRef } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { useAuth } from '../../context/AuthContext'
import { rescuer as rescuerApi } from '../../services/api'

const DEFAULT_CENTER = { lat: 9.799447, lng: 118.693766 }

function icon(g, scale, fillColor) {
  return {
    path: g.maps.SymbolPath.CIRCLE,
    scale,
    fillColor,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 4,
  }
}

export default function TeamMap() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY })
  const { user } = useAuth()
  const [rescuers, setRescuers] = useState([])
  const mapRef = useRef(null)
  const rescuerMarkersRef = useRef({})
  const infoWindowRef = useRef(null)
  const origPanToRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return
    const map = new window.google.maps.Map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
    })
    mapRef.current = map
    origPanToRef.current = map.panTo.bind(map)
    map.addListener('dragstart', () => console.log('[MAP] dragstart'))
    map.addListener('dragend', () => console.log('[MAP] dragend'))
    map.addListener('center_changed', () => {
      console.log('[MAP] center_changed', map.getCenter().toJSON(), new Error().stack?.split('\n').slice(2, 6).join('\n'))
    })
    console.log('[MAP] created at', DEFAULT_CENTER)
    fetchUserMarker(map)
    return () => {
      window.google.maps.event.clearInstanceListeners(map)
    }
  }, [isLoaded])

  function fetchUserMarker(map) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = window.google
        if (!g) return
        new g.maps.Marker({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          map,
          icon: icon(g, 10, '#2563eb'),
          title: 'Your Location',
        })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  useEffect(() => {
    const g = window.google
    if (!mapRef.current || !g) return

    console.log('[RESCUERS] updating markers, count:', rescuers.length)
    const ids = new Set(rescuers.filter((r) => r.rescuerEmail !== user?.email).map((r) => r.userId))

    for (const id of Object.keys(rescuerMarkersRef.current)) {
      if (!ids.has(id)) {
        rescuerMarkersRef.current[id].setMap(null)
        delete rescuerMarkersRef.current[id]
      }
    }

    for (const r of rescuers) {
      if (r.rescuerEmail === user?.email) continue
      const pos = { lat: r.latitude, lng: r.longitude }
      const existing = rescuerMarkersRef.current[r.userId]
      if (existing) {
        existing.setPosition(pos)
      } else {
        const marker = new g.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: icon(g, 8, '#16a34a'),
        })
        marker.addListener('click', () => {
          origPanToRef.current(pos)
          if (infoWindowRef.current) infoWindowRef.current.close()
          infoWindowRef.current = new g.maps.InfoWindow({
            position: pos,
            content: `<div class="text-sm font-medium text-gray-900">${r.rescuerName || r.userName}</div>`,
          })
          infoWindowRef.current.addListener('closeclick', () => { infoWindowRef.current = null })
          infoWindowRef.current.open(mapRef.current)
        })
        rescuerMarkersRef.current[r.userId] = marker
      }
    }
  }, [rescuers, user?.email])

  useEffect(() => {
    return () => {
      for (const id of Object.keys(rescuerMarkersRef.current)) {
        rescuerMarkersRef.current[id].setMap(null)
      }
      rescuerMarkersRef.current = {}
    }
  }, [])

  useEffect(() => {
    async function fetchLocations() {
      try {
        const data = await rescuerApi.getRescuerLocations()
        console.log('[FETCH] got', data.locations?.length, 'locations')
        setRescuers(data.locations || [])
      } catch {}
    }
    fetchLocations()
    const id = setInterval(fetchLocations, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Team Map</h1>
          <p className="mt-1 text-lg text-gray-500">See other rescuers in your area ({rescuers.length} online)</p>
        </div>
        <div ref={containerRef} className="rounded-xl overflow-hidden border-2 border-gray-200" style={{ height: '70vh' }}>
          {!isLoaded && (
            <div className="flex items-center justify-center h-full bg-gray-100 min-h-[500px]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
