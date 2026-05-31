import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Configuración de iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const LatencyHeatmap = ({ measurements }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    // Si no hay mediciones y el mapa existe, limpiar marcadores
    if (!mapRef.current) return

    // Inicializar mapa si no existe
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([40.416775, -3.703790], 13)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map)

      mapInstanceRef.current = map
    }

    // Limpiar marcadores anteriores
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []

    // Si no hay mediciones, mostrar mensaje
    if (measurements.length === 0) {
      return
    }

    // Añadir marcadores para cada medición
    measurements.forEach(m => {
      const color = getLatencyColor(m.latency)

      const marker = L.circleMarker([m.lat, m.lng], {
        radius: 12,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(mapInstanceRef.current)

      // Añadir popup con información
      marker.bindPopup(`
        <div style="font-family: Arial, sans-serif; min-width: 150px;">
          <strong>📡 Latencia:</strong> ${Math.round(m.latency)} ms<br/>
          <strong>📅 Fecha:</strong> ${new Date(m.timestamp).toLocaleString()}<br/>
          <strong>📍 Coordenadas:</strong><br/>
          ${m.lat.toFixed(6)}, ${m.lng.toFixed(6)}
        </div>
      `)

      markersRef.current.push(marker)
    })

    // Ajustar vista para mostrar todos los puntos
    if (measurements.length > 0) {
      const bounds = L.latLngBounds(measurements.map(m => [m.lat, m.lng]))
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] })
    }

    // Crear mapa de calor (opcional, usando leaflet-heatmap)
    createHeatmap(measurements)

  }, [measurements])

  const getLatencyColor = (latency) => {
    if (latency < 50) return '#00ff00'  // Verde - Excelente
    if (latency < 100) return '#7fff00' // Verde claro - Muy buena
    if (latency < 150) return '#ffff00' // Amarillo - Regular
    if (latency < 200) return '#ffa500' // Naranja - Lenta
    return '#ff0000'  // Rojo - Muy lenta
  }

  const createHeatmap = (data) => {
    // Función simple para crear efecto de mapa de calor
    // Agrupa puntos cercanos y calcula intensidad promedio
    const groupedData = groupPointsByProximity(data)

    groupedData.forEach(group => {
      if (group.points.length > 1) {
        const avgLatency = group.points.reduce((sum, p) => sum + p.latency, 0) / group.points.length
        const centerLat = group.points.reduce((sum, p) => sum + p.lat, 0) / group.points.length
        const centerLng = group.points.reduce((sum, p) => sum + p.lng, 0) / group.points.length
        const radius = calculateRadius(group.points)

        const color = getLatencyColor(avgLatency)
        const opacity = Math.min(0.3 + (group.points.length * 0.05), 0.7)

        const circle = L.circle([centerLat, centerLng], {
          radius: radius,
          color: color,
          weight: 1,
          opacity: 0.5,
          fillColor: color,
          fillOpacity: opacity
        }).addTo(mapInstanceRef.current)

        markersRef.current.push(circle)
      }
    })
  }

  const groupPointsByProximity = (points, distance = 10) => {
    // Agrupar puntos cercanos (distancia en metros aproximada)
    const groups = []
    const used = new Set()

    points.forEach((point, i) => {
      if (used.has(i)) return

      const group = {
        points: [point],
        indices: [i]
      }

      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue

        const distance = calculateDistance(point.lat, point.lng, points[j].lat, points[j].lng)
        if (distance < 0.001) { // ~100 metros
          group.points.push(points[j])
          group.indices.push(j)
          used.add(j)
        }
      }

      if (group.points.length > 0) {
        groups.push(group)
        used.add(i)
      }
    })

    return groups
  }

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const calculateRadius = (points) => {
    // Radio base en metros
    return Math.min(50 + (points.length * 10), 200)
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      {measurements.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.95)',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🗺️</div>
          <h3>Sin mediciones aún</h3>
          <p>Haz clic en "Medir Latencia" para comenzar</p>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Permite el acceso a tu ubicación cuando el navegador lo solicite
          </p>
        </div>
      )}
    </div>
  )
}

export default LatencyHeatmap