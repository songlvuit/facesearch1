import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Images, Search, Tag } from 'lucide-react'
import { getPhotos, getAllTags } from '../api/client'
import PhotoCard from '../components/PhotoCard'

export default function LibraryPage() {
  const [search,    setSearch]    = useState('')
  const [activeTag, setActiveTag] = useState(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', search],
    queryFn:  () => getPhotos(search),
  })
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn:  getAllTags,
  })

  const filtered = activeTag ? photos.filter(p => p.tags?.includes(activeTag)) : photos

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="section-title">Thư viện ảnh</h1>
        <p className="section-sub">{photos.length} ảnh trong database</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Tìm theo tên file hoặc hashtag…"
            value={search} onChange={e => { setSearch(e.target.value); setActiveTag(null) }} />
        </div>

        {tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag size={13} className="text-gray-400" />
            <button onClick={() => setActiveTag(null)}
              className={`badge cursor-pointer transition ${!activeTag ? 'badge-blue' : 'badge-gray'}`}>
              Tất cả
            </button>
            {tags.map(t => (
              <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`badge cursor-pointer transition ${activeTag === t ? 'badge-blue' : 'badge-gray'}`}>
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-32 text-gray-300">
          <span className="animate-spin text-4xl">⏳</span>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-32 text-gray-200 gap-4">
          <Images size={72} strokeWidth={1} />
          <p className="text-sm text-gray-400">Chưa có ảnh nào. Sync từ Google Drive để bắt đầu.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(p => <PhotoCard key={p.id} photo={p} />)}
        </div>
      )}
    </div>
  )
}
