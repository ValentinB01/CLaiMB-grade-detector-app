import { useState, useEffect } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { Palette, MapPin, QrCode, Save, Building2, Printer, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL
const GYM_ID = import.meta.env.VITE_GYM_ID

export default function Settings() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [color, setColor] = useState('#22d3ee')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    axios
      .get(`${API_URL}/community/gyms/${GYM_ID}`)
      .then((res) => {
        const g = res.data
        setName(g.name || '')
        setAddress(g.address || '')
        setColor(g.primary_color || '#22d3ee')
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await axios.put(`${API_URL}/community/gyms/${GYM_ID}`, {
        name,
        address,
        primary_color: color,
      })
      alert('✅ Setările au fost salvate cu succes!')
    } catch {
      alert('❌ Eroare la salvarea setărilor.')
    } finally {
      setIsSaving(false)
    }
  }

  const qrValue = JSON.stringify({ type: 'gym_join', gym_id: GYM_ID })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm font-medium">Se încarcă setările…</span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Setări & QR</h1>
      <p className="mt-1 text-slate-500 mb-6">Configurează detaliile sălii și generează codul QR.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Card 1: Branding ──────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Profilul Sălii</h2>
          </div>

          <div className="space-y-5">
            {/* Nume Sală */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Building2 size={14} className="text-slate-400" />
                Nume Sală
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bouldering Hub"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Adresă */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <MapPin size={14} className="text-slate-400" />
                Adresă
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Str. Cățărătorilor Nr. 7, Cluj-Napoca"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Culoare Principală */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Palette size={14} className="text-slate-400" />
                Culoare Principală
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                />
                <span className="text-sm font-mono font-medium text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
                  {color.toUpperCase()}
                </span>
                <div
                  className="h-10 flex-1 rounded-lg border border-slate-200"
                  style={{ backgroundColor: color }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Această culoare va fi tema aplicației mobile a clienților tăi.
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Se salvează…' : 'Salvează Modificările'}
          </button>
        </div>

        {/* ── Card 2: Generator QR ──────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <QrCode size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Generator QR Check-in</h2>
          </div>

          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Printează acest cod și pune-l la recepție. Clienții îl vor scana din
            aplicația <span className="font-semibold text-slate-700">CLaiMB</span> pentru
            a intra în Arenă.
          </p>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 mb-4">
              <QRCodeSVG
                value={qrValue}
                size={200}
                level="H"
                fgColor="#0f172a"
                includeMargin
              />
            </div>

            <p className="text-xs text-slate-400 text-center mb-1 font-mono">
              gym_id: {GYM_ID}
            </p>
            <p className="text-xs text-slate-400 text-center mb-6">
              Scanează cu aplicația CLaiMB
            </p>

            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              <Printer size={16} />
              Descarcă PDF / Printează
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
