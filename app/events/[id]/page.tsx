'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, EventRegistration } from '@/lib/types'

export default function EventDetailPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [regs, setRegs] = useState<EventRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)
      const { data: ev } = await supabase
        .from('events')
        .select('*, organizer:organizer_id(full_name), faculty:faculty_id(full_name,department), hod:hod_id(full_name)')
        .eq('id', eventId).single()
      if (!ev) { toast.error('Event not found'); router.push('/dashboard/student'); return }
      setEvent(ev)
      const { data: r } = await supabase
        .from('event_registrations').select('*')
        .eq('event_id', eventId).order('registered_at', { ascending: false })
      setRegs(r || [])
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading || !profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ color: 'var(--t4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
    </div>
  )
  if (!event) return null

  const attended   = regs.filter(r => r.attended).length
  const odPending  = regs.filter(r => ['pending','faculty_approved'].includes(r.od_status)).length
  const odApproved = regs.filter(r => r.od_status === 'hod_approved').length
  const backPath   = profile.role === 'student' ? '/dashboard/student' : '/dashboard/faculty'

  const filtered = regs.filter(r => {
    const matchSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.reg_number.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || (filterStatus === 'present' && r.attended) || (filterStatus === 'absent' && !r.attended) || (filterStatus === 'od_approved' && r.od_status === 'hod_approved')
    return matchSearch && matchStatus
  })

  const typeIcon: Record<string,string> = { technical:'⚡', hackathon:'🚀', cultural:'🎭', sports:'🏆', other:'📌' }

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>

        {/* Back */}
        <Link href={backPath} style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>← Back</Link>

        {/* Event header */}
        <div className="card-accent" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-overlay)', border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {typeIcon[event.event_type] || '📌'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>{event.title}</h1>
                  <span className={`badge type-${event.event_type}`}>{event.event_type}</span>
                  <span className={`badge status-${event.status}`}>{event.status.replace(/_/g,' ')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.8 }}>
                  <span>🏢 {event.club_name}</span>
                  <span style={{ margin: '0 8px', color: 'var(--t4)' }}>·</span>
                  <span>📅 {event.event_date}</span>
                  {event.start_time && <span> {event.start_time}{event.end_time ? `–${event.end_time}` : ''}</span>}
                  <span style={{ margin: '0 8px', color: 'var(--t4)' }}>·</span>
                  <span>📍 {event.venue}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>
                  Organizer: {(event.organizer as any)?.full_name}
                  {(event.faculty as any) && <span> · Faculty: {(event.faculty as any).full_name}</span>}
                  {(event.hod as any) && <span> · HOD: {(event.hod as any).full_name}</span>}
                </div>
                {event.description && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 8, lineHeight: 1.6 }}>{event.description}</div>}
              </div>
            </div>
            {event.status === 'approved' && profile.id === event.organizer_id && (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={`/events/${eventId}/qr`}><button className="btn btn-primary btn-sm">QR Code</button></Link>
                <Link href={`/events/${eventId}/scanner`}><button className="btn btn-ghost btn-sm">Scanner</button></Link>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '1.75rem' }}>
          {[
            { l: 'Registered',     v: regs.length,     c: 'var(--t1)' },
            { l: 'Present',        v: attended,         c: 'var(--teal-light)' },
            { l: 'OD in progress', v: odPending,        c: '#fbbf24' },
            { l: 'OD approved',    v: odApproved,       c: 'var(--indigo-light)' },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <div className="stat-num" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-lbl">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Table section */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Table toolbar */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, flex: 1 }}>
              Registered students <span style={{ color: 'var(--t4)', fontWeight: 400, fontSize: 12 }}>({filtered.length})</span>
            </div>
            <input
              className="inp" placeholder="Search name or reg no..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: 200, padding: '7px 12px', fontSize: 13 }}
            />
            <select className="inp" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140, padding: '7px 12px', fontSize: 13 }}>
              <option value="all">All students</option>
              <option value="present">Present only</option>
              <option value="absent">Absent only</option>
              <option value="od_approved">OD approved</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
              {regs.length === 0 ? 'No students registered yet.' : 'No students match your filter.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Register No.</th>
                    <th>Dept / Year</th>
                    <th>Role</th>
                    <th>Attendance</th>
                    <th>OD Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--t4)', fontSize: 11 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.attended ? 'rgba(45,212,191,0.12)' : 'var(--bg-overlay)', border: `1px solid ${r.attended ? 'rgba(45,212,191,0.25)' : 'var(--border-dim)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: r.attended ? 'var(--teal-light)' : 'var(--t3)', flexShrink: 0, fontFamily: 'var(--font-display)' }}>
                            {r.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--indigo-light)' }}>{r.reg_number}</td>
                      <td style={{ color: 'var(--t3)', fontSize: 12 }}>{r.department}{r.section ? ` · ${r.section}` : ''}<br /><span style={{ fontSize: 11, color: 'var(--t4)' }}>{r.year_sem}</span></td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{r.role_in_event}</span></td>
                      <td>
                        <span className={`badge ${r.attended ? 'badge-teal' : 'badge-gray'}`}>
                          {r.attended ? '✓ Present' : 'Absent'}
                        </span>
                        {r.attended_at && <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 3 }}>{new Date(r.attended_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>}
                      </td>
                      <td><span className={`badge status-${r.od_status}`} style={{ fontSize: 10 }}>{r.od_status.replace(/_/g,' ')}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--t4)' }}>{new Date(r.registered_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export hint */}
        {regs.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const rows = [['Name','Reg No','Dept','Year','Section','Role','Attended','OD Status','Phone','Email']]
              regs.forEach(r => rows.push([r.full_name, r.reg_number, r.department, r.year_sem, r.section||'', r.role_in_event, r.attended?'Yes':'No', r.od_status, r.phone||'', r.email||'']))
              const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
              const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
              a.download = `${event.title.replace(/\s+/g,'-')}-registrations.csv`; a.click()
              toast.success('CSV exported!')
            }}>↓ Export CSV</button>
          </div>
        )}
      </div>
    </div>
  )
}
