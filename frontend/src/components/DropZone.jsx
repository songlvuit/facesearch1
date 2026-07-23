import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import clsx from 'clsx'

export default function DropZone({ onFile, preview, onClear }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpg','.jpeg','.png','.webp','.bmp'] },
    multiple: false,
    onDrop: ([f]) => f && onFile(f),
  })

  if (preview) return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-brand-200">
      <img src={preview} alt="query" className="w-full object-cover max-h-64" />
      <button onClick={onClear}
        className="absolute top-2 right-2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow">
        <X size={14} />
      </button>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent px-3 py-2">
        <p className="text-white text-xs font-medium">Ảnh truy vấn</p>
      </div>
    </div>
  )

  return (
    <div {...getRootProps()} className={clsx(
      'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all',
      isDragActive ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
    )}>
      <input {...getInputProps()} />
      <div className={clsx('p-4 rounded-2xl transition', isDragActive ? 'bg-brand-100' : 'bg-gray-100')}>
        <Upload size={28} className={isDragActive ? 'text-brand-500' : 'text-gray-400'} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">
          {isDragActive ? 'Thả ảnh vào đây…' : 'Kéo & thả ảnh khuôn mặt'}
        </p>
        <p className="text-xs text-gray-400 mt-1">hoặc click để chọn · JPG PNG WEBP</p>
      </div>
    </div>
  )
}
