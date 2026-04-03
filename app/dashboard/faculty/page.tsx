'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, ODRequest } from '@/lib/types'

export default function FacultyDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tab, setTab] = useState<'events'|'od'>('events')
  const [pendingEvents, setPendingEvents] = useState<Event[]>([])
  const [myEvents, setMyEvents] = useState<Event[]>([])
  const [odRequests, setOdRequests] = useState<ODRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      if (p.role === 'hod') { router.push('/dashboard/hod'); return }
      if (p.role !== 'faculty') { router.push('/dashboard/student'); return }
      setProfile(p)
      const { data: pend } = await supabase.from('events').select('*, organizer:organizer_id(full_name, reg_number, department)').eq('faculty_id', user.id).eq('status', 'pending_approval').order('created_at', { ascending: false })
      setPendingEvents(pend || [])
      const { data: all } = await supabase.from('events').select('*, organizer:organizer_id(full_name)').eq('faculty_id', user.id).neq('status', 'pending_approval').order('created_at', { ascending: false })
      setMyEvents(all || [])
      const { data: ods } = await supabase.from('od_requests').select('*, event:event_id(title,event_date,venue), registration:registration_id(full_name,reg_number,department,year_sem,role_in_event)').eq('faculty_id', user.id).eq('faculty_status', 'pending').order('created_at', { ascending: false })
      setOdRequests(ods || [])
      setLoading(false)
    }
    load()
  }, [])

  async function approveEvent(id: string, approve: boolean) {
    await supabase.from('events').update({ status: approve ? 'approved' : 'rejected', faculty_remarks: remarks[id] || '' }).eq('id', id)
    toast.success(approve ? 'Event approved! QR is now live.' : 'Event rejected.')
    setPendingEvents(p => p.filter(e => e.id !== id))
    if (approve) { const { data: ev } = await supabase.from('events').select('*, organizer:organizer_id(full_name)').eq('id', id).single(); if (ev) setMyEvents(p => [ev, ...p]) }
  }

  async function approveOD(id: string, approve: boolean) {
    const od = odRequests.find(o => o.id === id)
    await supabase.from('od_requests').update({ faculty_status: approve ? 'approved' : 'rejected', faculty_remarks: remarks[id] || '', faculty_acted_at: new Date().toISOString() }).eq('id', id)
    if (od) await supabase.from('event_registrations').update({ od_status: approve ? 'faculty_approved' : 'rejected' }).eq('id', od.registration_id)
    toast.success(approve ? 'OD approved → forwarded to HOD' : 'OD rejected')
    setOdRequests(p => p.filter(o => o.id !== id))
  }

  if (loading || !profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ color: 'var(--t4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Faculty Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>{profile.full_name} · {profile.department}</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: '2rem' }}>
          {[
            { l: 'Pending approvals', v: pendingEvents.length, c: '#fbbf24' },
            { l: 'Events managed',    v: myEvents.length,      c: 'var(--indigo-light)' },
            { l: 'OD pending',        v: odRequests.length,    c: 'var(--teal-light)' },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <div className="stat-num" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-lbl">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
          {(['events','od'] as const).map(t => (
            <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'events' ? `Event approvals${pendingEvents.length > 0 ? ` (${pendingEvents.length})` : ''}` : `OD requests${odRequests.length > 0 ? ` (${odRequests.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingEvents.length === 0 && myEvents.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>No events assigned to you yet.</div>
            )}
            {pendingEvents.map(ev => (
              <div key={ev.id} className="approval-card" style={{ borderColor: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="approval-card-head">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{ev.title}</span>
                      <span className={`badge type-${ev.event_type}`}>{ev.event_type}</span>
                      <span className="badge badge-amber">Pending approval</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{ev.club_name} · {ev.venue} · {ev.event_date}</div>
                    <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 2 }}>By {(ev.organizer as any)?.full_name} ({(ev.organizer as any)?.reg_number}) · {(ev.organizer as any)?.department}</div>
                    {ev.description && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6, lineHeight: 1.5 }}>{ev.description}</div>}
                  </div>
                </div>
                <div className="approval-card-body">
                  <label className="lbl">Remarks (optional)</label>
                  <input className="inp" placeholder="Add remarks for the organizer..." value={remarks[ev.id] || ''} onChange={e => setRemarks(r => ({ ...r, [ev.id]: e.target.value }))} />
                </div>
                <div className="approval-card-foot">
                  <button className="btn btn-teal" style={{ flex: 1 }} onClick={() => approveEvent(ev.id, true)}>✓ Approve event</button>
                  <button className="btn btn-danger" onClick={() => approveEvent(ev.id, false)}>✕ Reject</button>
                </div>
              </div>
            ))}
            {myEvents.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>Managed events</div>
                {myEvents.map(ev => (
                  <div key={ev.id} className="card card-hover" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{ev.title}</span>
                        <span className={`badge status-${ev.status}`}>{ev.status.replace(/_/g,' ')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{ev.event_date} · {ev.venue}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'od' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {odRequests.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>No OD requests pending your approval.</div>
            )}
            {odRequests.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} className="approval-card" style={{ border: '1px solid rgba(45,212,191,0.15)' }}>
                  <div className="approval-card-head">
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{reg?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>{reg?.reg_number} · {reg?.department} · {reg?.year_sem}</div>
                      <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 4 }}>Event: <strong style={{ color: 'var(--t2)' }}>{ev?.title}</strong> · {ev?.event_date} · Role: {reg?.role_in_event}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--indigo-light)', flexShrink: 0 }}>{od.slip_id}</span>
                  </div>
                  <div className="approval-card-body">
                    <label className="lbl">Remarks (optional)</label>
                    <input className="inp" placeholder="Add remarks..." value={remarks[od.id] || ''} onChange={e => setRemarks(r => ({ ...r, [od.id]: e.target.value }))} />
                  </div>
                  <div className="approval-card-foot">
                    <button className="btn btn-teal" style={{ flex: 1 }} onClick={() => approveOD(od.id, true)}>✓ Approve OD</button>
                    <button className="btn btn-danger" onClick={() => approveOD(od.id, false)}>✕ Reject</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
