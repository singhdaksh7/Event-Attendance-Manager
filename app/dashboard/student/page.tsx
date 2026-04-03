'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, EventRegistration } from '@/lib/types'

function typeBadge(t: string) {
  return `badge type-${t}`
}
function statusBadge(s: string) {
  return `badge status-${s.replace(/ /g,'_')}`
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myEvents, setMyEvents] = useState<Event[]>([])
  const [myRegs, setMyRegs] = useState<EventRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
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
      const { data: evs } = await supabase.from('events')
        .select('*, faculty:faculty_id(full_name)')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false })
      setMyEvents(evs || [])
      const { data: regs } = await supabase.from('event_registrations')
        .select('*, event:event_id(title, event_date, venue, event_type)')
        .eq('student_id', user.id)
        .order('registered_at', { ascending: false })
      setMyRegs(regs || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t4)' }}>Loading...</div>
    </div>
  )

  const stats = [
    { label: 'Events created',  value: myEvents.length,                                         color: 'var(--indigo-light)' },
    { label: 'Events joined',   value: myRegs.length,                                            color: 'var(--teal-light)' },
    { label: 'Attended',        value: myRegs.filter(r => r.attended).length,                    color: '#4ade80' },
    { label: 'OD approved',     value: myRegs.filter(r => r.od_status === 'hod_approved').length, color: '#fbbf24' },
  ]

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
              Hey, {profile.full_name.split(' ')[0]} 👋
            </h1>
            <p style={{ fontSize: 13, color: 'var(--t3)' }}>{profile.department} · {profile.reg_number || profile.email}</p>
          </div>
          <Link href="/events/create">
            <button className="btn btn-primary">+ Create event</button>
          </Link>
        </div>

        {/* Stats */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: '2rem' }}>
          {stats.map(s => (
            <div key={s.label} className="stat-card fade-up">
              <div className="stat-num" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* My events */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Events I organised</h2>
            <Link href="/events/create" style={{ fontSize: 12, color: 'var(--indigo-light)', textDecoration: 'none' }}>+ New →</Link>
          </div>

          {myEvents.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <p style={{ color: 'var(--t3)', fontSize: 14, marginBottom: 16 }}>No events created yet.</p>
              <Link href="/events/create"><button className="btn btn-primary btn-sm">Create your first event</button></Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myEvents.map(ev => (
                <div key={ev.id} className="card card-hover" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{ev.title}</span>
                      <span className={`badge type-${ev.event_type}`}>{ev.event_type}</span>
                      <span className={`badge status-${ev.status}`}>{ev.status.replace(/_/g,' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {ev.venue} · {ev.event_date}
                      {(ev.faculty as any) && <span> · {(ev.faculty as any).full_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {ev.status === 'approved' && (
                      <Link href={`/events/${ev.id}/qr`}><button className="btn btn-ghost btn-sm">QR Code</button></Link>
                    )}
                    <Link href={`/events/${ev.id}/scanner`}><button className="btn btn-ghost btn-sm">Scanner</button></Link>
                    <Link href={`/events/${ev.id}`}><button className="btn btn-ghost btn-sm">View</button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My registrations */}
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: '1rem' }}>Events I registered for</h2>
          {myRegs.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
              Scan an event QR code to register for events.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myRegs.map(reg => (
                <div key={reg.id} className="card card-hover" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{(reg.event as any)?.title}</span>
                      <span className={`badge ${reg.attended ? 'badge-teal' : 'badge-gray'}`}>
                        {reg.attended ? '✓ Present' : 'Registered'}
                      </span>
                      {reg.od_status !== 'not_generated' && (
                        <span className={`badge status-${reg.od_status}`}>{reg.od_status.replace(/_/g,' ')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {(reg.event as any)?.event_date} · {(reg.event as any)?.venue}
                    </div>
                  </div>
                  {reg.od_status === 'hod_approved' && (
                    <Link href={`/od/${reg.id}`}><button className="btn btn-teal btn-sm">View OD slip →</button></Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
