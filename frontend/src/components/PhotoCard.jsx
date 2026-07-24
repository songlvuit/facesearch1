import { useState } from 'react'
import { X, Tag, ExternalLink, Download } from 'lucide-react'
import clsx from 'clsx'
import { addTag, removeTag } from '../api/client'
import { useQueryClient } from '@tanstack/react-query'

export default function PhotoCard({ photo, similarity }) {
  const [tagInput, setTagInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['photos'] })

  async function handleAdd(e) {
    e.preventDefault()
    if (!tagInput.trim()) return
    setBusy(true)
    try {
      for (const t of tagInput.split(',')) await addTag(photo.id, t)
      setTagInput(''); refresh()
    } finally { setBusy(false) }
  }

  const simPct = similarity !== undefined ? (similarity * 100).toFixed(1) : null
  const imgSrc = photo.thumbnail_url || `/api/photos/${photo.id}/image`

  return (
    <div className="card overflow-hidden group flex flex-col hover:shadow-md transition-shadow duration-200">
      {/* Thumbnail */}
      <div className="relative h-44 bg-gray-100 overflow-hidden shrink-0">
        <img src={imgSrc} alt={photo.file_name} loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

        {/* Similarity pill */}
        {simPct && (
          <div className="absolute top-2 right-2">
            <span className={clsx('badge font-bold shadow-sm',
              similarity >= 0.8 ? 'badge-green' : similarity >= 0.6 ? 'badge-blue' : 'badge-gray')}>
              {simPct}%
            </span>
          </div>
        )}

        {/* Not indexed */}
        {photo.has_embedding === false && (
          <div className="absolute bottom-2 left-2">
            <span className="badge-gray shadow-sm">Chưa index</span>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.drive_link && (
            <a href={photo.drive_link} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              title="Xem trên Google Drive"
              className="bg-white/90 hover:bg-white p-1.5 rounded-lg shadow text-gray-600 hover:text-brand-600">
              <ExternalLink size={13} />
            </a>
          )}
          {photo.download_url && (
            <a href={photo.download_url} download
              onClick={e => e.stopPropagation()}
              title="Tải ảnh về"
              className="bg-white/90 hover:bg-white p-1.5 rounded-lg shadow text-gray-600 hover:text-green-600">
              <Download size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-gray-500 truncate leading-relaxed" title={photo.file_name}>
          {photo.file_name}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 min-h-5">
          {photo.tags?.map(tag => (
            <button key={tag} onClick={() => { removeTag(photo.id, tag).then(refresh) }}
              title="Xoá tag"
              className="badge-blue group/t flex items-center gap-0.5 hover:bg-red-100 hover:text-red-600 transition-colors cursor-pointer">
              #{tag}
              <X size={9} className="opacity-0 group-hover/t:opacity-100" />
            </button>
          ))}
        </div>

        {/* Add tag */}
        {showForm ? (
          <form onSubmit={handleAdd} className="flex gap-1">
            <input className="input text-xs py-1.5 flex-1" placeholder="tag1, tag2…"
              value={tagInput} onChange={e => setTagInput(e.target.value)} autoFocus />
            <button type="submit" disabled={busy} className="btn-primary px-2 py-1 text-xs">✓</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-2 py-1 text-xs">✕</button>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors w-fit mt-auto">
            <Tag size={11} /> Thêm tag
          </button>
        )}
      </div>
    </div>
  )
}
