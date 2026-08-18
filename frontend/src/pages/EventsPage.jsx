import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Images, ScanFace } from 'lucide-react'
import { getEvents } from '../api/client'

export default function EventsPage() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvents().then(setEvents).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400 text-sm">Đang tải…</div>
  )

  if (!events.length) return (
    <div className="flex flex-col items-center justify-center py-32 text-gray-300 gap-4">
      <CalendarDays size={64} strokeWidth={1} />
      <p className="text-sm text-gray-400">Chưa có sự kiện nào</p>
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="section-title">Sự kiện</h1>
        <p className="section-sub">Chọn sự kiện để tìm kiếm khuôn mặt trong sự kiện đó</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {events.map(ev => (
          <Link key={ev.id} to={`/events/${ev.slug}`}
            className="card p-5 hover:shadow-md transition-shadow group flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
              <ScanFace size={20} className="text-brand-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{ev.name}</h3>
              {ev.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ev.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Images size={13} />
              <span>{ev.photo_count} ảnh</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
