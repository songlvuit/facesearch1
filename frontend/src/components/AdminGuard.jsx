import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

export default function AdminGuard({ children }) {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { setStatus('denied'); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? setStatus('ok') : setStatus('denied'))
      .catch(() => setStatus('denied'))
  }, [])

  if (status === 'checking') return null
  if (status === 'denied')   return <Navigate to="/admin/login" replace />
  return children
}
