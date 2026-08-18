import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Plus, Trash2, FolderPlus, FolderMinus, Pencil, Check, X } from 'lucide-react'
import clsx from 'clsx'
import { getEvents, createEvent, updateEvent, deleteEvent,
         addFolderToEvent, removeFolderFromEvent, getSyncFolders } from '../api/client'

function FolderBadge({ folderId, folderName, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-lg">
      {folderName || folderId.slice(0, 12) + '…'}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X size={11} />
      </button>
    </span>
  )
}

function EventRow({ ev, folders, onUpdate }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name,    setName]    = useState(ev.name)
  const [desc,    setDesc]    = useState(ev.description || '')
  const [adding,  setAdding]  = useState(false)
  const [selFolder, setSelFolder] = useState('')

  const allFolderIds = new Set(ev.folders)
  const available = folders.filter(f => !allFolderIds.has(f.folder_id))

  async function save() {
    await updateEvent(ev.id, name, desc || null)
    qc.invalidateQueries(['events'])
    setEditing(false)
  }

  async function del() {
    if (!confirm(`Xoá sự kiện "${ev.name}"?`)) return
    await deleteEvent(ev.id)
    qc.invalidateQueries(['events'])
  }

  async function addFolder() {
    if (!selFolder) return
    await addFolderToEvent(ev.id, selFolder)
    qc.invalidateQueries(['events'])
    setSelFolder(''); setAdding(false)
  }

  async function removeFolder(fid) {
    await removeFolderFromEvent(ev.id, fid)
    qc.invalidateQueries(['events'])
  }

  const folderName = (fid) => folders.find(f => f.folder_id === fid)?.folder_name || fid

  return (
    <div className="card p-5 space-y-3">
      {editing ? (
        <div className="space-y-2">
          <input className="input text-sm w-full" value={name} onChange={e => setName(e.target.value)}
            placeholder="Tên sự kiện" />
          <input className="input text-sm w-full" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Mô tả (tuỳ chọn)" />
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary text-xs py-1.5 px-3 gap-1.5">
              <Check size={13} /> Lưu
            </button>
            <button onClick={() => { setEditing(false); setName(ev.name); setDesc(ev.description||'') }}
              className="btn-secondary text-xs py-1.5 px-3">
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{ev.name}</p>
            {ev.description && <p className="text-xs text-gray-400 mt-0.5">{ev.description}</p>}
            <p className="text-xs text-gray-300 mt-0.5">{ev.photo_count} ảnh</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)}
              className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={del}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Folders */}
      <div>
        <p className="text-xs text-gray-400 font-medium mb-2">Folders Drive</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ev.folders.length === 0 && (
            <span className="text-xs text-gray-300">Chưa có folder nào</span>
          )}
          {ev.folders.map(fid => (
            <FolderBadge key={fid} folderId={fid} folderName={folderName(fid)}
              onRemove={() => removeFolder(fid)} />
          ))}
        </div>

        {adding ? (
          <div className="flex gap-2 mt-2">
            <select className="input text-xs flex-1" value={selFolder}
              onChange={e => setSelFolder(e.target.value)}>
              <option value="">-- Chọn folder --</option>
              {available.map(f => (
                <option key={f.folder_id} value={f.folder_id}>
                  {f.folder_name || f.folder_id}
                </option>
              ))}
            </select>
            <button onClick={addFolder} className="btn-primary text-xs py-1 px-3">Thêm</button>
            <button onClick={() => { setAdding(false); setSelFolder('') }}
              className="btn-secondary text-xs py-1 px-2"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
            <FolderPlus size={13} /> Thêm folder
          </button>
        )}
      </div>
    </div>
  )
}

export default function EventsAdminPage() {
  const qc = useQueryClient()
  const { data: events  = [] } = useQuery({ queryKey: ['events'],  queryFn: getEvents })
  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: getSyncFolders })

  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newDesc,  setNewDesc]  = useState('')

  async function create() {
    if (!newName.trim()) return
    await createEvent(newName.trim(), newDesc.trim() || null)
    qc.invalidateQueries(['events'])
    setNewName(''); setNewDesc(''); setCreating(false)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-title">Quản lý sự kiện</h1>
          <p className="section-sub">Tạo sự kiện và gán các folder Drive vào từng sự kiện</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="btn-primary gap-2">
          <Plus size={16} /> Tạo sự kiện
        </button>
      </div>

      {creating && (
        <div className="card p-5 mb-6 space-y-3">
          <p className="font-semibold text-sm text-gray-700">Sự kiện mới</p>
          <input className="input w-full text-sm" placeholder="Tên sự kiện *"
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()} autoFocus />
          <input className="input w-full text-sm" placeholder="Mô tả (tuỳ chọn)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()} />
          <div className="flex gap-2">
            <button onClick={create} className="btn-primary text-xs py-1.5 px-4 gap-1.5">
              <Check size={13} /> Tạo
            </button>
            <button onClick={() => { setCreating(false); setNewName(''); setNewDesc('') }}
              className="btn-secondary text-xs py-1.5 px-3">Huỷ</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-300 gap-4">
          <CalendarDays size={64} strokeWidth={1} />
          <p className="text-sm text-gray-400">Chưa có sự kiện nào. Nhấn "Tạo sự kiện" để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map(ev => (
            <EventRow key={ev.id} ev={ev} folders={folders} />
          ))}
        </div>
      )}
    </div>
  )
}
