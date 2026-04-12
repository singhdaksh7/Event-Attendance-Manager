'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, EventRegistration } from '@/lib/types'

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myEvents, setMyEvents] = useState<Event[]>([])
  const [myRegs,   setMyRegs]   = useState<EventRegistration[]>([])
  const [loading,  setLoading]  = useState(true)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      if (p.role !== 'student') { router.push(p.role === 'hod' ? '/dashboard/hod' : '/dashboard/faculty'); return }
      setProfile(p)
      const { data: evs } = await supabase.from('events').select('*, faculty:faculty_id(full_name)').eq('organizer_id', user.id).order('created_at', { ascending: false })
      setMyEvents(evs || [])
      const { data: regs } = await supabase.from('event_registrations').select('*, event:event_id(title,event_date,venue,event_type)').eq('student_id', user.id).order('registered_at', { ascending: false })
      setMyRegs(regs || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-dots">
        {[0,1,2].map(i => <div key={i} className="loading-dot" style={{ animationDelay:`${i*0.2}s` }} />)}
      </div>
    </div>
  )

  const stats = [
    { l: 'Events created', v: myEvents.length,                                        c: 'var(--t1)'    },
    { l: 'Registered',     v: myRegs.length,                                           c: 'var(--t1)'    },
    { l: 'Attended',       v: myRegs.filter(r => r.attended).length,                  c: '#34d399'      },
    { l: 'OD approved',    v: myRegs.filter(r => r.od_status === 'hod_approved').length, c: '#a78bfa'    },
  ]

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1>Dashboard</h1>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>{profile.department} · {profile.reg_number || profile.email}</p>
          </div>
          <Link href="/events/create"><button className="btn btn-primary">+ New event</button></Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 32 }}>
          {stats.map(s => (
            <div key={s.l} className="stat">
              <div className="stat-n" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* My events */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2>My events</h2>
            <Link href="/events/create" style={{ fontSize: 12, color: 'var(--accent-2)', textDecoration: 'none' }}>+ Create</Link>
          </div>
          {myEvents.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">📅</div>
              <p style={{ marginBottom: 14 }}>No events created yet.</p>
              <Link href="/events/create"><button className="btn btn-primary btn-sm">Create first event</button></Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--line)' }}>
              {myEvents.map(ev => (
                <div key={ev.id} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</span>
                      <span className={`badge type-${ev.event_type}`}>{ev.event_type}</span>
                      <span className={`badge status-${ev.status}`}>{ev.status.replace(/_/g,' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{ev.venue} · {ev.event_date}{(ev.faculty as any) ? ` · ${(ev.faculty as any).full_name}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {ev.status === 'approved' && <Link href={`/events/${ev.id}/qr`}><button className="btn btn-ghost btn-sm">QR</button></Link>}
                    <Link href={`/events/${ev.id}/scanner`}><button className="btn btn-ghost btn-sm">Scanner</button></Link>
                    <Link href={`/events/${ev.id}`}><button className="btn btn-ghost btn-sm">View</button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My registrations */}
        <div>
          <h2 style={{ marginBottom: 12 }}>Registered events</h2>
          {myRegs.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">🎫</div>
              Scan an event QR code to register.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--line)' }}>
              {myRegs.map(reg => (
                <div key={reg.id} style={{ background: 'var(--bg)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{(reg.event as any)?.title}</span>
                      <span className={`badge ${reg.attended ? 'badge-green' : 'badge-gray'}`}>{reg.attended ? 'Present' : 'Registered'}</span>
                      {reg.od_status !== 'not_generated' && <span className={`badge status-${reg.od_status}`}>{reg.od_status.replace(/_/g,' ')}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{(reg.event as any)?.event_date} · {(reg.event as any)?.venue}</div>
                  </div>
                  {reg.od_status === 'hod_approved' && (
                    <Link href={`/od/${reg.id}`}><button className="btn btn-ghost btn-sm">View OD</button></Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
