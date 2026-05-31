import React, { useState, useEffect } from 'react'
import LatencyHeatmap from './components/LatencyHeatmap'
import './App.css'

function App() {
  const [measurements, setMeasurements] = useState([])
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    avgLatency: 0,
    minLatency: 0,
    maxLatency: 0
  })

  // Cargar mediciones guardadas al iniciar
  useEffect(() => {
    const saved = localStorage.getItem('latencyMeasurements')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setMeasurements(data)
        updateStats(data)
      } catch (e) {
        console.error('Error loading saved data:', e)
      }
    }
  }, [])

  // Guardar mediciones cuando cambien
  useEffect(() => {
    if (measurements.length > 0) {
      localStorage.setItem('latencyMeasurements', JSON.stringify(measurements))
      updateStats(measurements)
    } else {
      updateStats([])
    }
  }, [measurements])

  const updateStats = (data) => {
    if (!data || data.length === 0) {
      setStats({ total: 0, avgLatency: 0, minLatency: 0, maxLatency: 0 })
      return
    }

    const latencies = data.map(m => m.latency)
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const min = Math.min(...latencies)
    const max = Math.max(...latencies)

    setStats({
      total: data.length,
      avgLatency: Math.round(avg),
      minLatency: Math.round(min),
      maxLatency: Math.round(max)
    })
  }

  const measureLatency = async () => {
    return new Promise((resolve) => {
      const startTime = performance.now()

      // Usar un endpoint confiable para medir latencia
      fetch('https://httpbin.org/get', {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
        .then(() => {
          const endTime = performance.now()
          const latency = endTime - startTime
          resolve(Math.min(latency, 1000)) // Limitar a 1000ms máximo
        })
        .catch(() => {
          // Fallback si falla la petición
          resolve(1000)
        })
    })
  }

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada en este navegador'))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      })
    })
  }

  const addMeasurement = async () => {
    setIsMeasuring(true)

    try {
      // Obtener ubicación
      const position = await getLocation()
      const { latitude, longitude } = position.coords

      // Medir latencia
      const latency = await measureLatency()

      // Crear nueva medición
      const newMeasurement = {
        id: Date.now(),
        lat: latitude,
        lng: longitude,
        latency: latency,
        timestamp: new Date().toISOString()
      }

      setMeasurements(prev => [...prev, newMeasurement])

      // Feedback visual
      alert(`✅ Medición completada!\n\n📍 Ubicación: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n📡 Latencia: ${Math.round(latency)}ms\n📊 Calidad: ${getQualityText(latency)}`)

    } catch (error) {
      console.error('Error:', error)

      if (error.code === 1) {
        alert('❌ Permiso de ubicación denegado.\n\nPor favor, recarga la página y permite el acceso a la ubicación.')
      } else if (error.code === 2) {
        alert('❌ Ubicación no disponible.\n\nVerifica que el GPS esté activado en tu dispositivo.')
      } else if (error.code === 3) {
        alert('⏰ Timeout obteniendo ubicación.\n\nIntenta nuevamente en un lugar con mejor señal GPS.')
      } else {
        alert(`❌ Error: ${error.message}`)
      }
    } finally {
      setIsMeasuring(false)
    }
  }

  const getQualityText = (latency) => {
    if (latency < 50) return 'Excelente 🟢'
    if (latency < 100) return 'Muy buena 🟢'
    if (latency < 150) return 'Regular 🟡'
    if (latency < 200) return 'Lenta 🟠'
    return 'Muy lenta 🔴'
  }

  const clearMeasurements = () => {
    if (confirm('⚠️ ¿Eliminar todas las mediciones?\n\nEsta acción no se puede deshacer.')) {
      setMeasurements([])
      localStorage.removeItem('latencyMeasurements')
    }
  }

  const exportData = () => {
    if (measurements.length === 0) {
      alert('No hay datos para exportar')
      return
    }

    const dataStr = JSON.stringify(measurements, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `mediciones-latencia-${new Date().toISOString().slice(0, 19)}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🗺️ Mapa de Calor - Latencia WiFi</h1>
        <p>Mide la latencia en diferentes puntos de tu casa y genera un mapa interactivo</p>
      </div>

      <div className="controls">
        <button
          className="btn btn-primary"
          onClick={addMeasurement}
          disabled={isMeasuring}
        >
          {isMeasuring ? '📡 Midiendo...' : '📍 Medir Latencia'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={exportData}
          disabled={measurements.length === 0}
        >
          💾 Exportar Datos
        </button>

        <button
          className="btn btn-danger"
          onClick={clearMeasurements}
          disabled={measurements.length === 0}
        >
          🗑️ Limpiar Todo
        </button>
      </div>

      <div className="stats">
        <div className="stat-item">
          <span className="stat-label">📊 Mediciones:</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">⚡ Latencia Promedio:</span>
          <span className="stat-value">{stats.avgLatency} ms</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">📉 Mínima:</span>
          <span className="stat-value">{stats.minLatency} ms</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">📈 Máxima:</span>
          <span className="stat-value">{stats.maxLatency} ms</span>
        </div>
      </div>

      <div className="map-container">
        <LatencyHeatmap measurements={measurements} />
      </div>

      {isMeasuring && (
        <div className="measuring">
          ⏳ Obteniendo ubicación y midiendo latencia...
        </div>
      )}

      <div className="info-panel">
        <h4>📖 Instrucciones</h4>
        <p>1️⃣ Muévete a diferentes puntos de tu casa</p>
        <p>2️⃣ Haz clic en "Medir Latencia"</p>
        <p>3️⃣ Permite el acceso a tu ubicación</p>
        <p>4️⃣ Repite en múltiples ubicaciones</p>
        <p>5️⃣ El mapa mostrará los puntos coloreados</p>

        <div className="legend">
          <h4>🎨 Calidad de Señal</h4>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#00ff00' }}></div>
            <span>Excelente (&lt;50ms)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#7fff00' }}></div>
            <span>Muy buena (50-100ms)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ffff00' }}></div>
            <span>Regular (100-150ms)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ffa500' }}></div>
            <span>Lenta (150-200ms)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#ff0000' }}></div>
            <span>Muy lenta (&gt;200ms)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App