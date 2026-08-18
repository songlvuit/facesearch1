import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Plus, Trash2, RefreshCw, Play,
         CheckCircle2, AlertCircle, Loader2, FolderOpen, ExternalLink, X } from 'lucide-react'
import clsx from 'clsx'
import { getSyncFolders, deleteSyncFolder, startSync,
         getSyncStatus, getSyncStats, invalidateCache, startReindex, importColab, clearAllData } from '../api/client'

// ── Import Colab Modal ────────────────────────────────────────────────────────
function ImportColabModal({ onClose, onSubmit }) {
  const [fileId,     setFileId]     = useState('')
  const [folderName, setFolderName] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!fileId.trim()) return
    onSubmit(fileId.trim(), folderName.trim() || null)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Import từ Colab</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">File ID của face_index.json *</label>
            <input
              className="input w-full text-sm font-mono"
              placeholder="1A2B3C4D5E..."
              value={fileId}
              onChange={e => setFileId(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Lấy từ bước cuối của Colab notebook</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Tên folder (tuỳ chọn)</label>
            <input
              className="input w-full text-sm"
              placeholder="Vd: Tiệc tất niên 2024, Lễ tốt nghiệp..."
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Nếu để trống sẽ dùng tên có trong file JSON</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!fileId.trim()} className="btn-primary flex-1 justify-center">
              Import
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">Huỷ</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ s }) {
  if (!s) return null
  const items = [
    { v: s.total,     label: 'Tổng ảnh',   cls: 'text-gray-800'   },
    { v: s.indexed,   label: 'Đã index',   cls: 'text-green-600'  },
    { v: s.unindexed, label: 'Chưa index', cls: 'text-orange-500' },
    { v: s.folders,   label: 'Folders',    cls: 'text-brand-600'  },
    { v: s.tagged,    label: 'Đã tag',     cls: 'text-purple-600' },
  ]
  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {items.map(i => (
        <div key={i.label} className="card p-4 text-center">
          <p className={clsx('text-2xl font-bold', i.cls)}>{i.v}</p>
          <p className="text-xs text-gray-400 mt-0.5">{i.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Add folder form ───────────────────────────────────────────────────────────
function AddForm({ onSubmit }) {
  const [open, setOpen] = useState(false)
  const [id, setId]     = useState('')
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!id.trim()) return
    onSubmit(id.trim(), name.trim() || null)
    setId(''); setName(''); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="btn-primary">
      <Plus size={15} /> Thêm folder Drive
    </button>
  )

  return (
    <form onSubmit={submit} className="card p-5 space-y-3 w-80">
      <p className="font-semibold text-sm text-gray-800">Thêm Google Drive Folder</p>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Folder ID <span className="text-red-400">*</span></label>
        <input className="input" placeholder="1A2B3C4D…" value={id}
          onChange={e => setId(e.target.value)} autoFocus />
        <p className="text-xs text-gray-400 mt-1">
          URL: drive.google.com/drive/folders/<span className="text-brand-600 font-mono">ID_ở_đây</span>
        </p>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Tên gợi nhớ (tuỳ chọn)</label>
        <input className="input" placeholder="Ảnh sự kiện 2024…" value={name}
          onChange={e => setName(e.target.value)} />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1 justify-center">Thêm & Sync</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3">Huỷ</button>
      </div>
    </form>
  )
}

// ── Sync progress ─────────────────────────────────────────────────────────────
function Progress({ jobId, onDone }) {
  const [job, setJob] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    ref.current = setInterval(async () => {
      try {
        const d = await getSyncStatus(jobId)
        setJob(d)
        if (d.status === 'finished' || d.status === 'error') {
          clearInterval(ref.current)
          if (d.status === 'finished') { await invalidateCache(); onDone?.() }
        }
      } catch { clearInterval(ref.current) }
    }, 800)
    return () => clearInterval(ref.current)
  }, [jobId])

  if (!job) return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <Loader2 size={13} className="animate-spin" /> Khởi động…
    </div>
  )
  if (job.status === 'error') return (
    <div className="flex items-center gap-1 text-xs text-red-500">
      <AlertCircle size={13} /> {job.error}
    </div>
  )

  const done = job.status === 'finished'
  const pct  = job.new > 0 ? Math.round(job.done / job.new * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className={clsx('flex items-center gap-1 font-medium',
          done ? 'text-green-600' : 'text-brand-600')}>
          {done
            ? <><CheckCircle2 size={13} /> Hoàn thành!</>
            : <><Loader2 size={13} className="animate-spin" />
               {job.status === 'listing' ? 'Đang quét folder…' : `Đang xử lý ${job.done}/${job.new}…`}</>}
        </span>
        <span className="text-gray-400">{pct}%</span>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
        {[
          ['⬇', job.downloaded, 'Tải về',   'text-blue-600'  ],
          ['🖼', job.thumbnailed,'Thumbnail','text-purple-600'],
          ['🧠', job.indexed,   'Index',    'text-green-600' ],
          ['✕',  job.failed,    'Lỗi',      'text-red-500'   ],
        ].map(([ic, val, lbl, cls]) => (
          <div key={lbl} className="bg-gray-50 rounded-xl py-2">
            <p className={clsx('font-bold text-lg leading-none', cls)}>{val}</p>
            <p className="text-gray-400 mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Folder card ───────────────────────────────────────────────────────────────
function FolderCard({ folder, onDelete, onSynced }) {
  const [jobId,   setJobId]   = useState(null)
  const [syncing, setSyncing] = useState(false)

  async function sync(skipExisting) {
    setSyncing(true)
    try {
      const d = await startSync(folder.folder_id, folder.folder_name, skipExisting)
      setJobId(d.job_id)
    } catch (e) { alert(e.message); setSyncing(false) }
  }

  function done() { setSyncing(false); setJobId(null); onSynced?.() }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-brand-50 rounded-xl shrink-0">
            <FolderOpen size={20} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {folder.folder_name || 'Folder không tên'}
            </p>
            <p className="text-xs text-gray-400 font-mono truncate">{folder.folder_id}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <a href={`https://drive.google.com/drive/folders/${folder.folder_id}`}
            target="_blank" rel="noreferrer" className="btn-ghost p-2" title="Mở Drive">
            <ExternalLink size={14} />
          </a>
          <button onClick={() => onDelete(folder.folder_id)} className="btn-ghost p-2 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex gap-4 text-xs text-gray-400">
        {folder.photo_count > 0 && <span>📷 {folder.photo_count} ảnh đã sync</span>}
        {folder.last_synced_at
          ? <span>🕐 {new Date(folder.last_synced_at).toLocaleString('vi-VN')}</span>
          : <span className="text-orange-400 font-medium">Chưa sync</span>}
      </div>

      {/* Progress */}
      {jobId && (
        <div className="bg-gray-50 rounded-xl p-4">
          <Progress jobId={jobId} onDone={done} />
        </div>
      )}

      {/* Actions */}
      {!jobId && (
        <div className="flex gap-2">
          <button onClick={() => sync(true)} disabled={syncing}
            className="btn-primary flex-1 justify-center text-sm">
            <RefreshCw size={14} /> Cập nhật (ảnh mới)
          </button>
          <button onClick={() => sync(false)} disabled={syncing}
            className="btn-secondary flex-1 justify-center text-sm" title="Re-process toàn bộ">
            <Play size={14} /> Sync lại toàn bộ
          </button>
        </div>
      )}
    </div>
  )
}

// ── Re-index progress ─────────────────────────────────────────────────────────
function ReindexProgress({ jobId, onDone }) {
  const [job, setJob] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    ref.current = setInterval(async () => {
      try {
        const d = await getSyncStatus(jobId)
        setJob(d)
        if (d.status === 'finished' || d.status === 'error') {
          clearInterval(ref.current)
          if (d.status === 'finished') { await invalidateCache(); onDone?.() }
        }
      } catch { clearInterval(ref.current) }
    }, 800)
    return () => clearInterval(ref.current)
  }, [jobId])

  if (!job) return <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={13} className="animate-spin" /> Khởi động…</div>
  if (job.status === 'error') return <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={13} />{job.error}</div>

  const done = job.status === 'finished'
  const pct  = job.total > 0 ? Math.round(job.done / job.total * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className={clsx('flex items-center gap-1 font-medium', done ? 'text-green-600' : 'text-brand-600')}>
          {done
            ? <><CheckCircle2 size={13} /> Hoàn thành! Index thêm {job.indexed} ảnh</>
            : <><Loader2 size={13} className="animate-spin" /> Re-index {job.done}/{job.total}…</>}
        </span>
        <span className="text-gray-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
        {[['🧠', job.indexed, 'Đã index', 'text-green-600'], ['✕', job.failed, 'Lỗi', 'text-red-500'], ['📷', job.total, 'Tổng', 'text-gray-500']].map(([ic, val, lbl, cls]) => (
          <div key={lbl} className="bg-gray-50 rounded-xl py-2">
            <p className={clsx('font-bold text-lg leading-none', cls)}>{val}</p>
            <p className="text-gray-400 mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DrivePage() {
  const qc = useQueryClient()
  const [reindexJobId, setReindexJobId] = useState(null)
  const [reindexing, setReindexing] = useState(false)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['folders'] })
    qc.invalidateQueries({ queryKey: ['sync-stats'] })
    qc.invalidateQueries({ queryKey: ['photos'] })
  }

  const { data: folders = [], refetch: rfFolders } = useQuery({
    queryKey: ['folders'], queryFn: getSyncFolders,
  })
  const { data: stats } = useQuery({
    queryKey: ['sync-stats'], queryFn: getSyncStats, refetchInterval: 5000,
  })

  async function handleAdd(folderId, folderName) {
    await startSync(folderId, folderName, true)
    rfFolders()
  }

  async function handleDelete(folderId) {
    if (!confirm('Xoá folder này? (Ảnh đã tải KHÔNG bị xoá)')) return
    await deleteSyncFolder(folderId); rfFolders()
  }

  async function handleReindex() {
    setReindexing(true)
    try {
      const d = await startReindex()
      setReindexJobId(d.job_id)
    } catch (e) { alert(e.message); setReindexing(false) }
  }

  function reindexDone() {
    setReindexing(false); setReindexJobId(null); refresh()
  }

  const [showImportModal,  setShowImportModal]  = useState(false)
  const [confirmClear,     setConfirmClear]     = useState(false)

  async function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return }
    try {
      await clearAllData()
      setConfirmClear(false)
      refresh()
    } catch (e) { alert(e.message) }
  }

  async function handleImportColab(fileId, folderName) {
    setShowImportModal(false)
    try {
      const d = await importColab(fileId, folderName)
      setReindexJobId(d.job_id)
      setReindexing(true)
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {showImportModal && (
        <ImportColabModal
          onClose={() => setShowImportModal(false)}
          onSubmit={handleImportColab}
        />
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="section-title">Google Drive & Database</h1>
          <p className="section-sub">Mỗi lần sync = tải ảnh + thumbnail + index face — tự động, 1 bước</p>
        </div>
        <div className="flex gap-2 items-start flex-wrap justify-end">
          <button onClick={() => setShowImportModal(true)} disabled={reindexing}
            className="btn-secondary">
            ☁️ Import từ Colab
          </button>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Xác nhận xoá tất cả?</span>
              <button onClick={handleClearAll}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium">
                Xoá
              </button>
              <button onClick={() => setConfirmClear(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                Huỷ
              </button>
            </div>
          ) : (
            <button onClick={handleClearAll}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium">
              <Trash2 size={14} /> Xoá tất cả data
            </button>
          )}
          {stats?.unindexed > 0 && !reindexJobId && (
            <button onClick={handleReindex} disabled={reindexing}
              className="btn-secondary">
              <RefreshCw size={14} /> Re-index ({stats.unindexed} ảnh)
            </button>
          )}
          <AddForm onSubmit={handleAdd} />
        </div>
      </div>

      {reindexJobId && (
        <div className="card p-5 mb-6 border-green-100 bg-green-50">
          <p className="text-sm font-semibold text-green-700 mb-3">🧠 Đang re-index ảnh chưa có vector…</p>
          <ReindexProgress jobId={reindexJobId} onDone={reindexDone} />
        </div>
      )}

      <StatsBar s={stats} />

      {/* Pipeline banner */}
      <div className="card p-4 mb-6 bg-gradient-to-r from-brand-50 to-purple-50 border-brand-100">
        <div className="flex items-center gap-3 flex-wrap text-sm text-brand-700 font-medium">
          {['⬇ Tải ảnh từ Drive', '🖼 Thumbnail 160×160', '🧠 Face vector 512D', '💾 Lưu DB'].map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-brand-300 font-light">→</span>}
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Folder list */}
      {folders.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-gray-200 gap-4">
          <HardDrive size={72} strokeWidth={1} />
          <p className="text-sm text-gray-400">Nhấn "Thêm folder Drive" để bắt đầu</p>
        </div>
      ) : (
        <div className="space-y-4">
          {folders.map(f => (
            <FolderCard key={f.folder_id} folder={f}
              onDelete={handleDelete} onSynced={refresh} />
          ))}
        </div>
      )}

      {/* Setup guide */}
      <details className="mt-8">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 font-medium">
          Hướng dẫn cấu hình Google Drive API
        </summary>
        <div className="mt-3 card p-5 text-sm text-gray-600 space-y-1.5">
          <p>1. Tạo project tại <span className="font-mono text-brand-600">console.cloud.google.com</span></p>
          <p>2. Bật <strong>Google Drive API</strong></p>
          <p>3. Tạo <strong>Service Account</strong> → tải <code className="bg-gray-100 px-1 rounded text-xs">credentials.json</code></p>
          <p>4. Đặt file vào thư mục gốc <code className="bg-gray-100 px-1 rounded text-xs">face_search_app/credentials.json</code></p>
          <p>5. Share thư mục Drive cho email Service Account (quyền Viewer)</p>
        </div>
      </details>
    </div>
  )
}
