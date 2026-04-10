import { useEffect, useState } from 'react'
import axios from 'axios'
import { Send, Trash2, Loader2, Newspaper } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL
const GYM_ID = import.meta.env.VITE_GYM_ID

interface NewsItem {
  id: string
  title: string
  content: string
  date: string
  emoji?: string
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const fetchNews = async () => {
    try {
      const { data } = await axios.get<NewsItem[]>(
        `${API_URL}/community/gyms/${GYM_ID}/news`,
      )
      // filter out the default placeholder entry
      setNews(data.filter((n) => n.id !== 'default'))
    } catch (err) {
      console.error('Eroare la încărcarea știrilor:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await axios.post(`${API_URL}/community/gyms/${GYM_ID}/news`, {
        title: title.trim(),
        content: content.trim(),
      })
      setTitle('')
      setContent('')
      await fetchNews()
    } catch (err) {
      console.error('Eroare la publicarea știrii:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (newsId: string) => {
    try {
      await axios.delete(`${API_URL}/community/gyms/${GYM_ID}/news/${newsId}`)
      setNews((prev) => prev.filter((n) => n.id !== newsId))
    } catch (err) {
      console.error('Eroare la ștergerea știrii:', err)
    }
  }

  const formatDate = (raw: string) => {
    try {
      return new Date(raw).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return raw
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Noutăți</h1>
        <p className="mt-1 text-slate-500">
          Publică știri și anunțuri pentru comunitate.
        </p>
      </div>

      {/* ── Publish Form ────────────────────── */}
      <form
        onSubmit={handlePublish}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Știre nouă
        </h2>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Titlu
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Program modificat de sărbători"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Content */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Conținut
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrie aici detaliile anunțului..."
              className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Publică Știrea
            </button>
          </div>
        </div>
      </form>

      {/* ── News List ───────────────────────── */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Știri publicate
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : news.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
            Nicio știre publicată încă. Folosește formularul de mai sus.
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <div
                key={item.id}
                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Icon */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                  <Newspaper size={20} />
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate text-sm font-semibold text-slate-800">
                      {item.title}
                    </h3>
                    <span className="flex-shrink-0 text-xs text-slate-400">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  {item.content && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {item.content}
                    </p>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex-shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Șterge știrea"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
