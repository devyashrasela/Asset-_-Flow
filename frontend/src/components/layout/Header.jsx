import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, RefreshCw, Check, ExternalLink } from 'lucide-react'
import { Button } from '../common/Button'
import api from '../../api/axios'
import { cn } from '../../utils'

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function Header({ title, breadcrumbs = [], onRefresh }) {
  const navigate = useNavigate()

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const dropdownRef = useRef(null)

  // Fetch unread count on mount
  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(({ data }) => setUnreadCount(data.count ?? data.unread_count ?? 0))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch recent notifications when dropdown opens
  useEffect(() => {
    if (!dropdownOpen) return
    setLoadingNotifs(true)
    api.get('/notifications/recent')
      .then(({ data }) => setNotifications(data.notifications || data || []))
      .catch(() => {})
      .finally(() => setLoadingNotifs(false))
  }, [dropdownOpen])

  const handleToggle = () => setDropdownOpen((p) => !p)

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await api.put('/notifications/mark-all-read')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all read:', err)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNotifClick = async (notif) => {
    if (!notif.read && !notif.is_read) {
      try {
        await api.put(`/notifications/${notif.id}/read`)
        setNotifications((prev) =>
          prev.map((n) => n.id === notif.id ? { ...n, read: true, is_read: true } : n)
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch (err) {
        console.error('Failed to mark notification read:', err)
      }
    }
  }

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)
  const isUnread = (n) => !n.read && !n.is_read

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-neutral-300">/</span>}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-neutral-900">{crumb}</span>
            ) : (
              <span className="text-neutral-500">{crumb}</span>
            )}
          </span>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" title="Search">
          <Search className="h-4 w-4" />
        </Button>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Notifications"
            onClick={handleToggle}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-danger-500 text-white text-[10px] font-bold px-1 leading-none">
                {badgeText}
              </span>
            )}
          </Button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200">
                <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications list */}
              <div className="max-h-80 overflow-y-auto">
                {loadingNotifs ? (
                  <div className="p-4 space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse space-y-1.5">
                        <div className="h-3.5 bg-neutral-100 rounded w-3/4" />
                        <div className="h-3 bg-neutral-100 rounded w-full" />
                        <div className="h-2.5 bg-neutral-100 rounded w-16" />
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => handleNotifClick(notif)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors block',
                        isUnread(notif) && 'border-l-2 border-blue-500 bg-blue-50/30'
                      )}
                    >
                      <p className={cn('text-sm', isUnread(notif) ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700')}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        {timeAgo(notif.created_at || notif.timestamp)}
                      </p>
                    </button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-neutral-200 px-4 py-2">
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); navigate('/activity-log') }}
                  className="w-full text-center text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1 py-1"
                >
                  View All <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
