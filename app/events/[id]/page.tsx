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
  const [event,   setEvent]   = useState<Event | null>(null)
  const [regs,    setRegs]    = useState<EventRegistration[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const eventId  = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)
      const { data: ev } = await supabase.from('events').select('*, organizer:organizer_id(full_name), faculty:faculty_id(full_name,department), hod:hod_id(full_name)').eq('id', eventId).single()
      if (!ev) { toast.error('Not found'); router.push('/dashboard/student'); return }
      setEvent(ev)
      const { data: r } = await supabase.from('event_registrations').select('*').eq('event_id', eventId).order('registered_at',{ascending:false})
      setRegs(r || [])
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading || !profile) return null
  if (!event) return null

  const attended   = regs.filter(r => r.attended).length
  const odApproved = regs.filter(r => r.od_status === 'hod_approved').length
  const backPath   = profile.role === 'student' ? '/dashboard/student' : '/dashboard/faculty'
  const filtered   = regs.filter(r => !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.reg_number.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <Link href={backPath} className="back-link">← Back</Link>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, marginBottom:24, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
              <h1>{event.title}</h1>
              <span className={`badge type-${event.event_type}`}>{event.event_type}</span>
              <span className={`badge status-${event.status}`}>{event.status.replace(/_/g,' ')}</span>
            </div>
            <div style={{ fontSize:13, color:'var(--t3)' }}>{event.club_name} · {event.event_date} · {event.venue}</div>
            <div style={{ fontSize:12, color:'var(--t4)', marginTop:2 }}>
              {(event.organizer as any)?.full_name}
              {(event.faculty as any) && ` · Faculty: ${(event.faculty as any).full_name}`}
            </div>
          </div>
          {event.status === 'approved' && profile.id === event.organizer_id && (
            <div style={{ display:'flex', gap:8 }}>
              <Link href={`/events/${eventId}/qr`}><button className="btn btn-primary btn-sm">QR Code</button></Link>
              <Link href={`/events/${eventId}/scanner`}><button className="btn btn-ghost btn-sm">Scanner</button></Link>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:24 }}>
          {[
            { l:'Registered', v:regs.length },
            { l:'Present',    v:attended },
            { l:'Absent',     v:regs.length - attended },
            { l:'OD approved',v:odApproved },
          ].map(s => <div key={s.l} className="stat"><div className="stat-n">{s.v}</div><div className="stat-l">{s.l}</div></div>)}
        </div>

        {/* Table */}
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
            <span style={{ fontSize:13, fontWeight:500 }}>Students ({filtered.length})</span>
            <div style={{ display:'flex', gap:8 }}>
              <input className="inp" placeholder="Search name or reg no..." value={search} onChange={e => setSearch(e.target.value)} style={{ width:220, height:32 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const rows = [['Name','Reg No','Dept','Year','Section','Role','Attended','OD Status','Phone','Email']]
                regs.forEach(r => rows.push([r.full_name,r.reg_number,r.department,r.year_sem,r.section||'',r.role_in_event,r.attended?'Yes':'No',r.od_status,r.phone||'',r.email||'']))
                const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
                const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `${event.title.replace(/\s+/g,'-')}.csv`; a.click()
                toast.success('CSV exported!')
              }}>↓ CSV</button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', fontSize:13, color:'var(--t3)' }}>
              {regs.length === 0 ? 'No students registered yet.' : 'No results.'}
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="tbl">
                <thead><tr><th>#</th><th>Name</th><th>Reg No.</th><th>Dept / Year</th><th>Role</th><th>Attendance</th><th>OD</th></tr></thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ color:'var(--t4)', fontSize:11 }}>{i+1}</td>
                      <td style={{ fontWeight:500 }}>{r.full_name}</td>
                      <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{r.reg_number}</td>
                      <td style={{ fontSize:12, color:'var(--t3)' }}>{r.department}<br /><span style={{ fontSize:11, color:'var(--t4)' }}>{r.year_sem}{r.section ? ` · ${r.section}`:''}</span></td>
                      <td><span className="badge badge-gray" style={{ fontSize:10 }}>{r.role_in_event}</span></td>
                      <td><span className={`badge ${r.attended ? 'badge-green':'badge-gray'}`}>{r.attended ? 'Present':'Absent'}</span></td>
                      <td><span className={`badge status-${r.od_status}`} style={{ fontSize:10 }}>{r.od_status.replace(/_/g,' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
