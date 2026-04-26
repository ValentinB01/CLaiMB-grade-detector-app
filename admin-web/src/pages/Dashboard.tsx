import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Route as RouteIcon,
  Megaphone,
  Users,
  Plus,
  Send,
  QrCode,
  Loader2,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL
const GYM_ID = import.meta.env.VITE_GYM_ID

interface MetricCard {
  label: string
  value: number | string
  icon: React.ElementType
  accent: string
  bg: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [routesCount, setRoutesCount] = useState(0)
  const [newsCount, setNewsCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [routesRes, newsRes] = await Promise.all([
          axios.get(`${API_URL}/community/gyms/${GYM_ID}/routes`),
          axios.get(`${API_URL}/community/gyms/${GYM_ID}/news`),
        ])
        setRoutesCount(routesRes.data.length)
        // filter out the default placeholder entry
        const realNews = newsRes.data.filter(
          (n: { id: string }) => n.id !== 'default',
        )
        setNewsCount(realNews.length)
      } catch (err) {
        console.error('Eroare la încărcarea datelor dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const metrics: MetricCard[] = [
    {
      label: 'Trasee Active pe Perete',
      value: routesCount,
      icon: RouteIcon,
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Anunțuri Publicate',
      value: newsCount,
      icon: Megaphone,
      accent: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Check-in-uri Azi',
      value: 24,
      icon: Users,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ]

  const quickActions = [
    {
      label: 'Adaugă un Traseu Nou',
      icon: Plus,
      to: '/routes',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: 'Publică o Știre',
      icon: Send,
      to: '/news',
      color: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      label: 'Printează Codul QR',
      icon: QrCode,
      to: '/settings',
      color: 'bg-emerald-600 hover:bg-emerald-700',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Privire de ansamblu
        </h1>
        <p className="mt-1 text-slate-500">
          Sumar general al sălii tale.
        </p>
      </div>

      {/* ── Metric Cards ────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.label}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${m.bg} ${m.accent}`}
              >
                <Icon size={24} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {m.label}
                </p>
                {isLoading ? (
                  <Loader2
                    size={20}
                    className="mt-1 animate-spin text-slate-300"
                  />
                ) : (
                  <p className="mt-0.5 text-3xl font-bold text-slate-800">
                    {m.value}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Quick Actions ───────────────────── */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Acțiuni rapide
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className={`flex items-center gap-3 rounded-xl px-5 py-4 text-sm font-semibold text-white shadow-sm transition-colors ${action.color}`}
              >
                <Icon size={20} />
                {action.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
