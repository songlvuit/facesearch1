const BASE = '/api'

function authHeaders() {
  const token = localStorage.getItem('admin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    localStorage.removeItem('admin_token')
    window.location.href = '/admin/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// Photos
export const getPhotos    = (q = '')  => req(`/photos${q ? `?q=${encodeURIComponent(q)}` : ''}`)
export const getPhoto     = (id)      => req(`/photos/${id}`)
export const getAllTags    = ()        => req('/photos/tags/all')
export const addTag       = (id, tag) => req(`/photos/${id}/tags`, {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tag })
})
export const removeTag    = (id, tag) => req(`/photos/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' })

// Search
export const searchFace   = (file, topK = 12, threshold = 0.4) => {
  const fd = new FormData()
  fd.append('file', file); fd.append('top_k', topK); fd.append('threshold', threshold)
  return req('/search', { method: 'POST', body: fd })
}
export const invalidateCache = () => req('/search/invalidate', { method: 'POST' })

// Sync
export const getSyncStats   = ()                       => req('/sync/stats')
export const getSyncFolders = ()                       => req('/sync/folders')
export const deleteSyncFolder = (fid)                  => req(`/sync/folders/${encodeURIComponent(fid)}`, { method: 'DELETE' })
export const startSync      = (folder_id, folder_name, skip_existing = true) =>
  req('/sync/start', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ folder_id, folder_name, skip_existing }) })
export const getSyncStatus  = (jobId)                  => req(`/sync/status/${jobId}`)
export const startReindex     = ()         => req('/sync/reindex', { method: 'POST' })
export const importColab      = (file_id)  => req('/sync/import-colab', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ file_id })
})
