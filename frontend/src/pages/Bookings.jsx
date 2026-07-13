import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Plus, Search, Calendar, Clock, ChevronLeft, ChevronRight,
  X, CheckCircle, XCircle, ArrowLeft, CalendarDays, List, AlertTriangle
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { Label } from '../components/common/Label'
import { Alert } from '../components/common/Alert'
import { cn } from '../utils'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

const BOOKING_STATUS_COLORS = {
  'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  'Upcoming':         'bg-blue-50 text-blue-700 border-blue-200',
  'Ongoing':          'bg-orange-50 text-orange-700 border-orange-200',
  'Completed':        'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled':        'bg-neutral-100 text-neutral-500 border-neutral-300',
  'Rejected':         'bg-red-50 text-red-700 border-red-200',
  'Withdrawn':        'bg-neutral-100 text-neutral-500 border-neutral-300',
  'No Show':          'bg-red-50 text-red-600 border-red-200',
}

export function Bookings() {
  const navigate = useNavigate()
  const { assetTag } = useParams()
  const { pathname } = useLocation()
  const currentRole = useAuthStore((s) => s.currentRole)
  const user = useAuthStore((s) => s.user)
  const activeOrgId = useAuthStore((s) => s.activeOrgId)
  const workspaces = useAuthStore((s) => s.workspaces)
  const activeOrg = workspaces.find((w) => w.org_id === activeOrgId)

  let view = 'resources'
  if (pathname.includes('/approvals')) view = 'approvals'
  else if (pathname.includes('/my')) view = 'my'
  else if (assetTag) view = 'calendar'

  const isApprover = ['Admin', 'Asset Manager'].includes(currentRole)

  // Common state
  const [resources, setResources] = useState([])
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [orgMembers, setOrgMembers] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Resources filters
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarMode, setCalendarMode] = useState('day')
  const [activeAsset, setActiveAsset] = useState(null)
  const [bookings, setBookings] = useState([])

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [activeBooking, setActiveBooking] = useState(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

  // Form values
  const [bookingStart, setBookingStart] = useState('')
  const [bookingEnd, setBookingEnd] = useState('')
  const [bookingBookedFor, setBookingBookedFor] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Approvals & My
  const [approvalsQueue, setApprovalsQueue] = useState([])
  const [myBookings, setMyBookings] = useState([])

  // ── Fetch metadata ──────────────────────────────────────────────────────────
  const fetchMetadata = async () => {
    try {
      const { data: cats } = await api.get('/categories')
      setCategories(cats)
      const { data: depts } = await api.get('/departments')
      setDepartments(depts)
      if (isApprover) {
        const { data: membersList } = await api.get('/org/members')
        setOrgMembers(membersList)
        const { data: pendingList } = await api.get('/bookings/approvals')
        setPendingCount(pendingList.length)
      }
    } catch (err) {
      console.error('Error fetching bookings metadata:', err)
    }
  }

  useEffect(() => { fetchMetadata() }, [currentRole])

  // ── Resources ───────────────────────────────────────────────────────────────
  const fetchResources = async () => {
    if (view !== 'resources') return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (catFilter) params.append('category_id', catFilter)
      const { data } = await api.get(`/bookings/resources?${params.toString()}`)
      setResources(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchResources() }, [view, search, catFilter])

  // ── Calendar ────────────────────────────────────────────────────────────────
  const fetchCalendarBookings = async () => {
    if (view !== 'calendar' || !assetTag) return
    try {
      const { data: assetData } = await api.get(`/assets/${assetTag}`)
      setActiveAsset(assetData)
      let startBound = new Date(selectedDate)
      let endBound = new Date(selectedDate)
      if (calendarMode === 'week') {
        const weekDays = getWeekDays()
        startBound = new Date(weekDays[0])
        endBound = new Date(weekDays[6])
      }
      startBound.setHours(0, 0, 0, 0)
      endBound.setHours(23, 59, 59, 999)
      const { data } = await api.get(`/bookings`, { params: { asset_tag: assetTag, date_from: startBound.toISOString(), date_to: endBound.toISOString() } })
      setBookings(data)
    } catch (err) { console.error(err) }
  }

  useEffect(() => { fetchCalendarBookings() }, [view, assetTag, selectedDate, calendarMode])

  const handlePrevDate = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - (calendarMode === 'week' ? 7 : 1)); setSelectedDate(d) }
  const handleNextDate = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + (calendarMode === 'week' ? 7 : 1)); setSelectedDate(d) }

  const handleSlotClick = (day, hour) => {
    const s = new Date(day); s.setHours(hour, 0, 0, 0)
    const e = new Date(day); e.setHours(hour + 1, 0, 0, 0)
    const formatDTL = (d) => { const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16) }
    setBookingStart(formatDTL(s)); setBookingEnd(formatDTL(e))
    setBookingBookedFor(user?.name || ''); setBookingNote(''); setFormError(''); setShowBookingModal(true)
  }

  const handleBookingClick = (booking, e) => { e?.stopPropagation(); setActiveBooking(booking); setShowDetailDrawer(true) }

  // ── Submissions ─────────────────────────────────────────────────────────────
  const handleCreateBookingSubmit = async (e) => {
    e.preventDefault(); setFormError(''); setFormLoading(true)
    try {
      await api.post('/bookings', { asset_tag: assetTag, start_time: new Date(bookingStart).toISOString(), end_time: new Date(bookingEnd).toISOString(), booked_for: bookingBookedFor, booked_for_note: bookingNote })
      setShowBookingModal(false); fetchCalendarBookings(); fetchMetadata()
    } catch (err) { setFormError(err.response?.data?.error || err.message) }
    finally { setFormLoading(false) }
  }

  const handleApproveBooking = async (bookingId) => {
    if (!window.confirm('Approve this booking request?')) return
    try { await api.patch(`/bookings/${bookingId}/approve`); setShowDetailDrawer(false); fetchCalendarBookings(); fetchPendingRequests(); fetchMetadata() }
    catch (err) { alert(err.response?.data?.error || err.message) }
  }

  const handleRejectBookingSubmit = async (e) => {
    e.preventDefault(); if (!rejectionReason.trim()) return
    try { await api.patch(`/bookings/${activeBooking.id}/reject`, { reason: rejectionReason }); setShowRejectModal(false); setRejectionReason(''); setShowDetailDrawer(false); fetchCalendarBookings(); fetchPendingRequests(); fetchMetadata() }
    catch (err) { alert(err.response?.data?.error || err.message) }
  }

  const handleWithdrawRequest = async (bookingId) => {
    if (!window.confirm('Withdraw your booking request?')) return
    try { await api.patch(`/bookings/${bookingId}/withdraw`); setShowDetailDrawer(false); fetchCalendarBookings(); fetchMyBookingsList(); fetchMetadata() }
    catch (err) { alert(err.response?.data?.error || err.message) }
  }

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this booking?')) return
    try { await api.patch(`/bookings/${bookingId}/cancel`); setShowDetailDrawer(false); fetchCalendarBookings(); fetchMyBookingsList() }
    catch (err) { alert(err.response?.data?.error || err.message) }
  }

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault(); setFormError(''); setFormLoading(true)
    try { await api.patch(`/bookings/${activeBooking.id}/reschedule`, { start_time: new Date(bookingStart).toISOString(), end_time: new Date(bookingEnd).toISOString() }); setShowRescheduleModal(false); setShowDetailDrawer(false); fetchCalendarBookings(); fetchMyBookingsList() }
    catch (err) { setFormError(err.response?.data?.error || err.message) }
    finally { setFormLoading(false) }
  }

  const openRescheduleModal = () => {
    const fmt = (dStr) => { const d = new Date(dStr); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
    setBookingStart(fmt(activeBooking.start_time)); setBookingEnd(fmt(activeBooking.end_time)); setFormError(''); setShowRescheduleModal(true)
  }

  // ── Approvals & My ─────────────────────────────────────────────────────────
  const fetchPendingRequests = async () => {
    if (view !== 'approvals') return; setLoading(true)
    try { const { data } = await api.get('/bookings/approvals'); setApprovalsQueue(data) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchPendingRequests() }, [view])

  const fetchMyBookingsList = async () => {
    if (view !== 'my') return; setLoading(true)
    try { const { data } = await api.get('/bookings/my'); setMyBookings(data) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchMyBookingsList() }, [view])

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const calendarHours = Array.from({ length: 17 }, (_, i) => 6 + i)

  const getBookingLayoutStyles = (booking, targetDate) => {
    const start = new Date(booking.start_time)
    const end = new Date(booking.end_time)
    const viewDate = targetDate || selectedDate

    const dayStart = new Date(viewDate)
    dayStart.setHours(6, 0, 0, 0)
    const dayEnd = new Date(viewDate)
    dayEnd.setHours(22, 0, 0, 0)

    const clampStart = new Date(Math.max(start.getTime(), dayStart.getTime()))
    const clampEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()))

    if (clampStart >= clampEnd) {
      return { display: 'none' }
    }

    const total = 16 * 60 // 960 minutes
    const startMin = (clampStart.getHours() * 60 + clampStart.getMinutes()) - (6 * 60)
    const dur = (clampEnd.getTime() - clampStart.getTime()) / 60000

    const top = Math.max(0, (startMin / total) * 100)
    const height = Math.min(100 - top, (dur / total) * 100)

    return { top: `${top}%`, height: `${height}%`, position: 'absolute', left: '4px', right: '4px', zIndex: 2 }
  }

  const getWeekDays = () => {
    const days = [], current = new Date(selectedDate)
    const dow = current.getDay(), diff = current.getDate() - dow + (dow === 0 ? -6 : 1)
    current.setDate(diff)
    for (let i = 0; i < 7; i++) { days.push(new Date(current)); current.setDate(current.getDate() + 1) }
    return days
  }

  const getBookingBlockClasses = (status) => {
    switch (status) {
      case 'Pending Approval': return 'border border-dashed border-amber-400 bg-amber-50/80 text-amber-800'
      case 'Ongoing': return 'bg-orange-100 border-l-4 border-orange-500 text-orange-800 ring-1 ring-orange-300'
      case 'Completed': return 'bg-neutral-100 border-l-4 border-neutral-400 text-neutral-500'
      default: return 'bg-primary-50 border-l-4 border-primary-500 text-primary-800'
    }
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Header breadcrumbs={[activeOrg?.org_name || 'Workspace', 'Resource Booking']} onRefresh={view === 'calendar' ? fetchCalendarBookings : fetchResources} />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Page Header + Tabs */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title text-neutral-900">Resource Booking</h1>
            <p className="text-sm text-neutral-500 mt-1">Browse shared resources, book time slots, and manage reservations.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-neutral-200">
          <button
            onClick={() => navigate('/bookings')}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', (view === 'resources' || view === 'calendar') ? 'border-primary-500 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700')}
          >
            <Calendar className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />Browse Resources
          </button>
          <button
            onClick={() => navigate('/bookings/my')}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', view === 'my' ? 'border-primary-500 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700')}
          >
            <List className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />My Reservations
          </button>
          {isApprover && (
            <button
              onClick={() => navigate('/bookings/approvals')}
              className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', view === 'approvals' ? 'border-primary-500 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700')}
            >
              <CheckCircle className="h-4 w-4" />Pending Approvals
              {pendingCount > 0 && <span className="bg-amber-100 text-amber-700 font-bold text-[10px] rounded-full px-1.5 py-0.5">{pendingCount}</span>}
            </button>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* RESOURCES VIEW                                                    */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'resources' && (
          <>
            <div className="bg-white border border-neutral-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input placeholder="Search resources by name or tag..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="ml-auto text-xs text-neutral-500 font-medium">{resources.length} resources</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-neutral-100 animate-pulse rounded-lg border border-neutral-200" />)}
              </div>
            ) : resources.length === 0 ? (
              <div className="text-center py-16 bg-white border border-neutral-200 rounded-lg">
                <Calendar className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">No shared resources found. Register assets as "Shared Resource" to enable booking.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map(res => {
                  const isMaint = res.status === 'Under Maintenance'
                  return (
                    <div
                      key={res.tag}
                      onClick={() => navigate(`/bookings/${res.tag}`)}
                      className={cn(
                        'bg-white border border-neutral-200 rounded-lg p-5 cursor-pointer transition-all hover:border-primary-300 hover:shadow-md flex flex-col gap-3',
                        isMaint && 'opacity-60 border-dashed'
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-primary-600">{res.tag}</p>
                          <h3 className="text-sm font-semibold text-neutral-900 mt-0.5">{res.name}</h3>
                        </div>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                          res.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                        )}>{res.status}</span>
                      </div>
                      <p className="text-xs text-neutral-500">{res.Category?.name || 'Uncategorized'}</p>
                      <div className="border-t border-neutral-100 pt-3 mt-auto flex justify-between items-center text-xs">
                        <span className="text-neutral-400">Availability</span>
                        <span className={cn('font-semibold', res.next_booking_indicator?.startsWith('Free') ? 'text-emerald-600' : 'text-amber-600')}>
                          {res.next_booking_indicator || 'Open'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* CALENDAR VIEW                                                     */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'calendar' && (
          <div className="space-y-4">
            {/* Asset header */}
            <div className="bg-white border border-neutral-200 rounded-lg p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-600">{activeAsset?.tag}</span>
                  {activeAsset?.status && (
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                      activeAsset.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                    )}>{activeAsset.status}</span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 mt-1">{activeAsset?.name}</h2>
                <p className="text-xs text-neutral-500">Category: {activeAsset?.Category?.name || 'Shared'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate('/bookings')}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={() => { setBookingStart(''); setBookingEnd(''); setBookingBookedFor(user?.name || ''); setBookingNote(''); setFormError(''); setShowBookingModal(true) }} disabled={activeAsset?.status === 'Under Maintenance'}>
                  <Plus className="h-4 w-4" /> New Booking
                </Button>
              </div>
            </div>

            {activeAsset?.status === 'Under Maintenance' && (
              <Alert variant="warning">This resource is currently under maintenance. New bookings cannot be created.</Alert>
            )}

            {/* Calendar controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handlePrevDate}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="font-medium text-sm text-neutral-900 min-w-[200px] text-center">
                  {calendarMode === 'day'
                    ? selectedDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : `Week of ${getWeekDays()[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                </span>
                <Button variant="ghost" size="icon" onClick={handleNextDate}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="flex border border-neutral-200 rounded-md overflow-hidden">
                <button className={cn('px-3 py-1.5 text-xs font-medium transition-colors', calendarMode === 'day' ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-500 hover:bg-neutral-50')} onClick={() => setCalendarMode('day')}>Day</button>
                <button className={cn('px-3 py-1.5 text-xs font-medium transition-colors', calendarMode === 'week' ? 'bg-primary-50 text-primary-600' : 'bg-white text-neutral-500 hover:bg-neutral-50')} onClick={() => setCalendarMode('week')}>Week</button>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
              {calendarMode === 'day' ? (
                <div className="flex flex-col min-w-[600px] relative">
                  {calendarHours.map((hour) => (
                    <div key={hour} onClick={() => handleSlotClick(selectedDate, hour)} className="flex border-b border-neutral-100 h-16 cursor-pointer hover:bg-primary-50/30 transition-colors relative">
                      <div className="w-16 border-r border-neutral-100 text-xs font-medium text-neutral-400 p-2 select-none">{String(hour).padStart(2, '0')}:00</div>
                      <div className="flex-1" />
                    </div>
                  ))}
                  {bookings.map((booking) => (
                    <div key={booking.id} onClick={(e) => handleBookingClick(booking, e)}
                      className={cn('rounded-md p-2 overflow-hidden flex flex-col text-xs cursor-pointer select-none transition-all hover:brightness-95', getBookingBlockClasses(booking.status))}
                      style={{ ...getBookingLayoutStyles(booking, selectedDate), marginLeft: '64px' }}
                    >
                      <span className="font-semibold truncate">{booking.BookedBy?.name || 'Requester'}</span>
                      <span className="truncate mt-0.5 opacity-70">{booking.booked_for}</span>
                      <span className="font-mono text-[10px] opacity-60 mt-auto">
                        {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col min-w-[900px]">
                  <div className="flex border-b border-neutral-200 bg-neutral-50">
                    <div className="w-16 border-r border-neutral-200" />
                    {getWeekDays().map((day) => (
                      <div key={day.toISOString()} className="flex-1 text-center py-2.5 text-xs font-medium border-r border-neutral-200">
                        <div className="text-neutral-600">{day.toLocaleDateString([], { weekday: 'short' })}</div>
                        <div className="text-neutral-400 mt-0.5">{day.getDate()}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex relative" style={{ height: '680px' }}>
                    <div className="w-16 border-r border-neutral-200 flex flex-col relative h-full">
                      {calendarHours.map((hour, idx) => (
                        <div key={hour} style={{ position: 'absolute', top: `${(idx / calendarHours.length) * 100}%`, left: 0, right: 0, height: `${100 / calendarHours.length}%`, padding: '4px 6px', fontSize: '10px', color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}>
                          {String(hour).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                    {getWeekDays().map((day) => {
                      const dayBookings = bookings.filter(b => {
                        const bStart = new Date(b.start_time)
                        const bEnd = new Date(b.end_time)
                        const dStart = new Date(day)
                        dStart.setHours(0, 0, 0, 0)
                        const dEnd = new Date(day)
                        dEnd.setHours(23, 59, 59, 999)
                        return bStart < dEnd && bEnd > dStart
                      })
                      return (
                        <div key={day.toISOString()} className="flex-1 border-r border-neutral-100 h-full relative cursor-pointer hover:bg-primary-50/20" onClick={() => handleSlotClick(day, 9)}>
                          {calendarHours.map((_, idx) => (
                            <div key={idx} style={{ position: 'absolute', top: `${(idx / calendarHours.length) * 100}%`, left: 0, right: 0, height: `${100 / calendarHours.length}%`, borderBottom: '1px solid #f9fafb' }} />
                          ))}
                          {dayBookings.map((booking) => (
                            <div key={booking.id} style={getBookingLayoutStyles(booking, day)} onClick={(e) => handleBookingClick(booking, e)}
                              className={cn('rounded-md p-1.5 overflow-hidden flex flex-col text-[10px] cursor-pointer select-none hover:brightness-95', getBookingBlockClasses(booking.status))}
                            >
                              <span className="font-semibold truncate">{booking.BookedBy?.name || 'Requester'}</span>
                              <span className="font-mono text-[9px] opacity-60 mt-auto">{new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs bg-white border border-neutral-200 rounded-lg p-3 justify-center">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-dashed border-amber-400 bg-amber-50" /><span className="text-neutral-500">Pending</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-50 border-l-2 border-primary-500" /><span className="text-neutral-500">Upcoming</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-100 border-l-2 border-orange-500 ring-1 ring-orange-300" /><span className="text-neutral-500">Ongoing</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-neutral-100 border-l-2 border-neutral-400" /><span className="text-neutral-500">Completed</span></div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* APPROVALS VIEW                                                    */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'approvals' && (
          <div className="bg-white border border-neutral-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Requester</th>
                    <th className="py-3 px-4 text-table-header">Resource</th>
                    <th className="py-3 px-4 text-table-header">Start Time</th>
                    <th className="py-3 px-4 text-table-header">End Time</th>
                    <th className="py-3 px-4 text-table-header">Booked For</th>
                    <th className="py-3 px-4 text-table-header">Note</th>
                    <th className="py-3 px-4 text-table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    [...Array(4)].map((_, i) => <tr key={i}><td colSpan="7" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>)
                  ) : approvalsQueue.length === 0 ? (
                    <tr><td colSpan="7" className="p-12 text-center"><CheckCircle className="h-10 w-10 text-neutral-300 mx-auto mb-3" /><p className="text-sm text-neutral-500">No pending approval requests.</p></td></tr>
                  ) : approvalsQueue.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50/70 h-12">
                      <td className="py-2 px-4 text-sm font-medium text-neutral-900">{item.BookedBy?.name}</td>
                      <td className="py-2 px-4">
                        <p className="text-xs font-bold text-primary-600">{item.asset_tag}</p>
                        <p className="text-xs text-neutral-500">{item.Asset?.name}</p>
                      </td>
                      <td className="py-2 px-4 text-xs text-neutral-600">{new Date(item.start_time).toLocaleString()}</td>
                      <td className="py-2 px-4 text-xs text-neutral-600">{new Date(item.end_time).toLocaleString()}</td>
                      <td className="py-2 px-4 text-sm text-neutral-700">{item.booked_for}</td>
                      <td className="py-2 px-4 text-xs text-neutral-400 max-w-[120px] truncate">{item.booked_for_note || '—'}</td>
                      <td className="py-2 px-4">
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => handleApproveBooking(item.id)} disabled={item.booked_by_user_id === user?.id}>Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => { setActiveBooking(item); setRejectionReason(''); setShowRejectModal(true) }}>Reject</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
              Showing {approvalsQueue.length} pending requests
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* MY RESERVATIONS VIEW                                              */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {view === 'my' && (
          <div className="bg-white border border-neutral-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="py-3 px-4 text-table-header">Resource</th>
                    <th className="py-3 px-4 text-table-header">Start</th>
                    <th className="py-3 px-4 text-table-header">End</th>
                    <th className="py-3 px-4 text-table-header">Status</th>
                    <th className="py-3 px-4 text-table-header">Booked For</th>
                    <th className="py-3 px-4 text-table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    [...Array(4)].map((_, i) => <tr key={i}><td colSpan="6" className="p-4"><div className="h-6 bg-neutral-100 animate-pulse rounded" /></td></tr>)
                  ) : myBookings.length === 0 ? (
                    <tr><td colSpan="6" className="p-12 text-center"><CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" /><p className="text-sm text-neutral-500">You have no bookings yet.</p></td></tr>
                  ) : myBookings.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-50/70 transition-colors cursor-pointer h-12" onClick={(e) => handleBookingClick(item, e)}>
                      <td className="py-2 px-4">
                        <p className="text-xs font-bold text-primary-600">{item.asset_tag}</p>
                        <p className="text-xs text-neutral-500">{item.Asset?.name}</p>
                      </td>
                      <td className="py-2 px-4 text-xs text-neutral-600">{new Date(item.start_time).toLocaleString()}</td>
                      <td className="py-2 px-4 text-xs text-neutral-600">{new Date(item.end_time).toLocaleString()}</td>
                      <td className="py-2 px-4">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', BOOKING_STATUS_COLORS[item.status] || '')}>{item.status}</span>
                      </td>
                      <td className="py-2 px-4 text-sm text-neutral-700">{item.booked_for}</td>
                      <td className="py-2 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          {item.status === 'Pending Approval' && <Button size="sm" variant="secondary" onClick={() => handleWithdrawRequest(item.id)}>Withdraw</Button>}
                          {['Upcoming', 'Ongoing'].includes(item.status) && <Button size="sm" variant="danger" onClick={() => handleCancelBooking(item.id)}>Cancel</Button>}
                          {item.status === 'Upcoming' && <Button size="sm" variant="secondary" onClick={() => { setActiveBooking(item); openRescheduleModal() }}>Reschedule</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-neutral-200 bg-neutral-50/50 text-xs text-neutral-500">
              Showing {myBookings.length} reservations
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CREATE BOOKING MODAL                                                  */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBookingModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Request Resource Booking</h2>
                <p className="text-sm text-neutral-500 mt-0.5">All bookings require manager approval before confirmation.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowBookingModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <form onSubmit={handleCreateBookingSubmit} className="p-6 space-y-4">
              {formError && <Alert variant="error">{formError}</Alert>}
              <div className="space-y-1.5">
                <Label>Resource</Label>
                <Input value={`${activeAsset?.name} (${assetTag})`} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label required>Start Time</Label><Input type="datetime-local" value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} required disabled={formLoading} /></div>
                <div className="space-y-1.5"><Label required>End Time</Label><Input type="datetime-local" value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} required disabled={formLoading} /></div>
              </div>
              <div className="space-y-1.5">
                <Label required>Booked For</Label>
                {currentRole === 'Employee' ? (
                  <Input value={bookingBookedFor} disabled />
                ) : (
                  <select className="w-full h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none" value={bookingBookedFor} onChange={(e) => setBookingBookedFor(e.target.value)} required disabled={formLoading}>
                    <option value={user?.name}>{user?.name} (Self)</option>
                    {currentRole === 'Department Head' && departments.map(d => <option key={d.id} value={`${d.name} Department`}>{d.name} Department</option>)}
                    {isApprover && (
                      <>
                        <optgroup label="Departments">{departments.map(d => <option key={d.id} value={`${d.name} Department`}>{d.name} Department</option>)}</optgroup>
                        <optgroup label="Members">{orgMembers.map(m => <option key={m.user_id} value={m.User?.name}>{m.User?.name}</option>)}</optgroup>
                      </>
                    )}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <textarea className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" placeholder="Purpose description..." value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} disabled={formLoading} rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowBookingModal(false)} disabled={formLoading}>Cancel</Button>
                <Button type="submit" loading={formLoading}><Plus className="h-4 w-4" /> Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* BOOKING DETAIL DRAWER                                                 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showDetailDrawer && activeBooking && (
        <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDetailDrawer(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-white border-l border-neutral-200 shadow-xl flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: 'slideInRight 0.2s ease-out' }}>
            <div className="flex justify-between items-center p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg text-neutral-900">Booking Details</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDetailDrawer(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-6 space-y-4 text-sm flex-1">
              <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Resource</p><p className="font-medium text-neutral-900">{activeBooking.Asset?.name || activeBooking.asset_tag}</p><p className="text-xs font-mono text-neutral-400">{activeBooking.asset_tag}</p></div>
              <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Status</p><span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', BOOKING_STATUS_COLORS[activeBooking.status] || '')}>{activeBooking.status}</span></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Start</p><p className="text-neutral-700">{new Date(activeBooking.start_time).toLocaleString()}</p></div>
                <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">End</p><p className="text-neutral-700">{new Date(activeBooking.end_time).toLocaleString()}</p></div>
              </div>
              <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Booker</p><p className="text-neutral-700">{activeBooking.BookedBy?.name || 'Member'}</p></div>
              <div className="space-y-1"><p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Booked For</p><p className="text-neutral-700">{activeBooking.booked_for}</p></div>
              {activeBooking.booked_for_note && (
                <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-md space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">Note / Purpose</p>
                  <p className="text-neutral-600">{activeBooking.booked_for_note}</p>
                </div>
              )}
              {activeBooking.status === 'Rejected' && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-md space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-red-600">Rejection Reason</p>
                  <p className="text-red-700">{activeBooking.rejection_reason || 'No reason provided.'}</p>
                </div>
              )}
            </div>
            <div className="border-t border-neutral-200 p-6 space-y-2 bg-neutral-50/50">
              {activeBooking.status === 'Pending Approval' && isApprover && (
                <>
                  <Button className="w-full" onClick={() => handleApproveBooking(activeBooking.id)} disabled={activeBooking.booked_by_user_id === user?.id}><CheckCircle className="h-4 w-4" /> Approve</Button>
                  <Button variant="danger" className="w-full" onClick={() => { setRejectionReason(''); setShowRejectModal(true) }}><XCircle className="h-4 w-4" /> Reject</Button>
                </>
              )}
              {activeBooking.status === 'Pending Approval' && activeBooking.booked_by_user_id === user?.id && (
                <Button variant="secondary" className="w-full" onClick={() => handleWithdrawRequest(activeBooking.id)}>Withdraw Request</Button>
              )}
              {activeBooking.status === 'Upcoming' && (activeBooking.booked_by_user_id === user?.id || isApprover) && (
                <>
                  <Button variant="secondary" className="w-full" onClick={openRescheduleModal}>Reschedule</Button>
                  <Button variant="danger" className="w-full" onClick={() => handleCancelBooking(activeBooking.id)}>Cancel Booking</Button>
                </>
              )}
              {activeBooking.status === 'Ongoing' && (activeBooking.booked_by_user_id === user?.id || isApprover) && (
                <Button variant="danger" className="w-full" onClick={() => handleCancelBooking(activeBooking.id)}>Cancel Booking</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* REJECT MODAL                                                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200"><h2 className="text-lg font-semibold text-neutral-900">Reject Booking Request</h2></div>
            <form onSubmit={handleRejectBookingSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label required>Reason for Rejection</Label>
                <textarea className="flex w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" placeholder="Conflict details or alternate suggestion..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} required rows={3} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                <Button type="submit" variant="danger"><XCircle className="h-4 w-4" /> Confirm Reject</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* RESCHEDULE MODAL                                                      */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowRescheduleModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-200"><h2 className="text-lg font-semibold text-neutral-900">Reschedule Booking</h2></div>
            <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4">
              {formError && <Alert variant="error">{formError}</Alert>}
              <div className="space-y-1.5">
                <Label>Resource</Label>
                <Input value={activeBooking?.Asset?.name || activeBooking?.asset_tag} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label required>New Start</Label><Input type="datetime-local" value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} required disabled={formLoading} /></div>
                <div className="space-y-1.5"><Label required>New End</Label><Input type="datetime-local" value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} required disabled={formLoading} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200">
                <Button type="button" variant="ghost" onClick={() => setShowRescheduleModal(false)} disabled={formLoading}>Cancel</Button>
                <Button type="submit" loading={formLoading}><Clock className="h-4 w-4" /> Update Time Slot</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
