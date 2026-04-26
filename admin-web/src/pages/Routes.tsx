import { useEffect, useState } from 'react'
import axios from 'axios'
import { Plus, Trash2, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL
const GYM_ID = import.meta.env.VITE_GYM_ID

interface GymRoute {
  route_id: string
  gym_id: string
  name?: string | null
  color: string
  grade: string
  points: number
  set_date: string
  is_active: boolean
}

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10']
const COLORS = ['Alb', 'Galben', 'Verde', 'Albastru', 'Roșu', 'Negru']

const COLOR_DOT: Record<string, string> = {
  Alb: 'bg-white border border-slate-300',
  Galben: 'bg-yellow-400',
  Verde: 'bg-green-500',
  Albastru: 'bg-blue-500',
  'Roșu': 'bg-red-500',
  Negru: 'bg-slate-900',
}

export default function Routes() {
  const [routes, setRoutes] = useState<GymRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('V0')
  const [color, setColor] = useState('Alb')
  const [points, setPoints] = useState(100)

  const fetchRoutes = async () => {
    try {
      const { data } = await axios.get<GymRoute[]>(`${API_URL}/community/gyms/${GYM_ID}/routes`)
      setRoutes(data)
    } catch (err) {
      console.error('Eroare la încărcarea traseelor:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoutes()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post(`${API_URL}/community/gyms/${GYM_ID}/routes`, {
        gym_id: GYM_ID,
        name: name.trim() || null,
        color,
        grade,
        points,
      })
      setName('')
      setGrade('V0')
      setColor('Alb')
      setPoints(100)
      await fetchRoutes()
    } catch (err) {
      console.error('Eroare la adăugarea traseului:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (routeId: string) => {
    try {
      await axios.delete(`${API_URL}/community/gyms/${GYM_ID}/routes/${routeId}`)
      setRoutes((prev) => prev.filter((r) => r.route_id !== routeId))
    } catch (err) {
      console.error('Eroare la ștergerea traseului:', err)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Trasee</h1>
        <p className="mt-1 text-slate-500">Gestionează traseele active din sală.</p>
      </div>

      {/* ── Add Form ─────────────────────────── */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Adaugă traseu nou
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          {/* Nume */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Nume traseu <span className="text-slate-400">(opțional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Boulder roșu colț"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Grad */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Grad</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Culoare */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Culoare</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Puncte */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Puncte</label>
            <input
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Adaugă Traseu
          </button>
        </div>
      </form>

      {/* ── Routes List ──────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : routes.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Niciun traseu activ. Adaugă primul traseu folosind formularul de mai sus.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Culoare</th>
                  <th className="px-5 py-3">Nume</th>
                  <th className="px-5 py-3">Grad</th>
                  <th className="px-5 py-3">Puncte</th>
                  <th className="px-5 py-3">Dată</th>
                  <th className="px-5 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map((route) => (
                  <tr key={route.route_id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Color dot + label */}
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${COLOR_DOT[route.color] ?? 'bg-slate-300'}`}
                        />
                        <span className="text-slate-700">{route.color}</span>
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3 text-slate-700">
                      {route.name || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Grade */}
                    <td className="px-5 py-3">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                        {route.grade}
                      </span>
                    </td>

                    {/* Points */}
                    <td className="px-5 py-3 font-medium text-slate-700">{route.points}</td>

                    {/* Date */}
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(route.set_date).toLocaleDateString('ro-RO')}
                    </td>

                    {/* Delete */}
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(route.route_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Șterge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
