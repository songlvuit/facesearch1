import { useState } from 'react'
import { ScanFace, SlidersHorizontal, Search } from 'lucide-react'
import DropZone from '../components/DropZone'
import PhotoCard from '../components/PhotoCard'
import { searchFace } from '../api/client'

export default function SearchPage() {
  const [file,      setFile]      = useState(null)
  const [preview,   setPreview]   = useState(null)
  const [topK,      setTopK]      = useState(12)
  const [threshold, setThreshold] = useState(0.4)
  const [showOpts,  setShowOpts]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [results,   setResults]   = useState(null)
  const [error,     setError]     = useState(null)

  function pick(f) {
    setFile(f); setPreview(URL.createObjectURL(f)); setResults(null); setError(null)
  }
  function clear() {
    setFile(null); setPreview(null); setResults(null); setError(null)
  }
  async function run() {
    if (!file) return
    setLoading(true); setError(null)
    try { setResults((await searchFace(file, topK, threshold)).results) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title">Tìm kiếm theo khuôn mặt</h1>
        <p className="section-sub">Upload ảnh có khuôn mặt — hệ thống tìm những ảnh giống nhất trong database</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Left panel */}
        <div className="space-y-4">
          <DropZone onFile={pick} preview={preview} onClear={clear} />

          {/* Options toggle */}
          <button onClick={() => setShowOpts(v => !v)} className="btn-secondary w-full justify-center">
            <SlidersHorizontal size={15} />
            Tuỳ chỉnh tìm kiếm
          </button>

          {showOpts && (
            <div className="card p-4 space-y-5">
              <div>
                <div className="flex justify-between text-xs font-medium text-gray-600 mb-2">
                  <span>Số kết quả tối đa</span>
                  <span className="text-brand-600 font-bold">{topK}</span>
                </div>
                <input type="range" min={1} max={50} value={topK}
                  onChange={e => setTopK(+e.target.value)}
                  className="w-full h-1.5 rounded-full accent-brand-600 cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-gray-600 mb-2">
                  <span>Độ tương đồng tối thiểu</span>
                  <span className="text-brand-600 font-bold">{(threshold*100).toFixed(0)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={threshold}
                  onChange={e => setThreshold(+e.target.value)}
                  className="w-full h-1.5 rounded-full accent-brand-600 cursor-pointer" />
              </div>
            </div>
          )}

          <button onClick={run} disabled={!file || loading}
            className="btn-primary w-full justify-center py-3 text-base">
            {loading
              ? <><span className="animate-spin inline-block">⏳</span> Đang tìm…</>
              : <><Search size={18} /> Tìm kiếm</>}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {/* Empty state */}
          {results === null && !loading && (
            <div className="h-full flex flex-col items-center justify-center py-32 text-gray-200 gap-4">
              <ScanFace size={72} strokeWidth={1} />
              <p className="text-sm text-gray-400">Upload ảnh và nhấn Tìm kiếm</p>
            </div>
          )}

          {/* No results */}
          {results?.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-32 text-gray-400 gap-3">
              <p className="text-4xl">🤷</p>
              <p className="text-sm font-medium">Không tìm thấy kết quả phù hợp</p>
              <p className="text-xs text-gray-300">Thử giảm ngưỡng tương đồng hoặc chọn ảnh khác</p>
            </div>
          )}

          {/* Results grid */}
          {results?.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{results.length}</span> kết quả
                </p>
                <div className="flex gap-1 text-xs text-gray-400">
                  <span className="badge-green">≥80%</span>
                  <span className="badge-blue">≥60%</span>
                  <span className="badge-gray">&lt;60%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {results.map(r => (
                  <PhotoCard key={r.photo_id}
                    photo={{ id: r.photo_id, file_name: r.file_name, tags: r.tags,
                             thumbnail_url: r.thumbnail_url, drive_link: r.drive_link,
                             has_embedding: true }}
                    similarity={r.similarity}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
