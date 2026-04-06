'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, ODRequest } from '@/lib/types'

export default function FacultyDashboard() {
  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [tab,           setTab]           = useState<'events'|'od'>('events')
  const [pendingEvents, setPendingEvents] = useState<Event[]>([])
  const [myEvents,      setMyEvents]      = useState<Event[]>([])
  const [odRequests,    setOdRequests]    = useState<ODRequest[]>([])
  const [remarks,       setRemarks]       = useState<Record<string,string>>({})
  const [loading,       setLoading]       = useState(true)
  const router   = useRouter()
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
      const { data: pend } = await supabase.from('events').select('*, organizer:organizer_id(full_name,reg_number,department)').eq('faculty_id', user.id).eq('status','pending_approval').order('created_at',{ascending:false})
      setPendingEvents(pend || [])
      const { data: all } = await supabase.from('events').select('*, organizer:organizer_id(full_name)').eq('faculty_id', user.id).neq('status','pending_approval').order('created_at',{ascending:false})
      setMyEvents(all || [])
      const { data: ods } = await supabase.from('od_requests').select('*, event:event_id(title,event_date,venue), registration:registration_id(full_name,reg_number,department,year_sem,role_in_event)').eq('faculty_id', user.id).eq('faculty_status','pending').order('created_at',{ascending:false})
      setOdRequests(ods || [])
      setLoading(false)
    }
    load()
  }, [])

  async function approveEvent(id: string, approve: boolean) {
    await supabase.from('events').update({ status: approve ? 'approved' : 'rejected', faculty_remarks: remarks[id] || '' }).eq('id', id)
    toast.success(approve ? 'Event approved' : 'Event rejected')
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
    <div className="page" style={{ display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ display:'flex',gap:5 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:'50%',background:'var(--t4)',animation:'bounce 1.2s ease-in-out infinite',animationDelay:`${i*0.2}s` }}/>)}</div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  )

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ marginBottom:28 }}>
          <h1>Faculty Dashboard</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>{profile.full_name} · {profile.department}</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:28 }}>
          {[
            { l:'Event approvals', v:pendingEvents.length },
            { l:'Events managed',  v:myEvents.length },
            { l:'OD pending',      v:odRequests.length },
          ].map(s => <div key={s.l} className="stat"><div className="stat-n">{s.v}</div><div className="stat-l">{s.l}</div></div>)}
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          {(['events','od'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab===t?'on':''}`} onClick={() => setTab(t)}>
              {t === 'events' ? `Event approvals${pendingEvents.length>0?` (${pendingEvents.length})`:''}`:`OD requests${odRequests.length>0?` (${odRequests.length})`:''}`}
            </button>
          ))}
        </div>

        {tab === 'events' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {pendingEvents.length === 0 && myEvents.length === 0 && (
              <div className="card card-p" style={{ textAlign:'center', color:'var(--t3)', fontSize:13 }}>No events assigned yet.</div>
            )}
            {pendingEvents.map(ev => (
              <div key={ev.id} className="acard" style={{ borderColor:'rgba(245,158,11,0.2)' }}>
                <div className="acard-head">
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:600, fontSize:14 }}>{ev.title}</span>
                        <span className={`badge type-${ev.event_type}`}>{ev.event_type}</span>
                        <span className="badge badge-amber">Pending</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--t3)' }}>{ev.club_name} · {ev.venue} · {ev.event_date}</div>
                      <div style={{ fontSize:12, color:'var(--t4)', marginTop:2 }}>By {(ev.organizer as any)?.full_name} ({(ev.organizer as any)?.reg_number})</div>
                      {ev.description && <div style={{ fontSize:12, color:'var(--t3)', marginTop:6, lineHeight:1.5 }}>{ev.description}</div>}
                    </div>
                  </div>
                </div>
                <div className="acard-body">
                  <label className="lbl">Remarks (optional)</label>
                  <input className="inp" placeholder="Add remarks..." value={remarks[ev.id]||''} onChange={e => setRemarks(r=>({...r,[ev.id]:e.target.value}))} />
                </div>
                <div className="acard-foot">
                  <button className="btn btn-success" style={{ flex:1 }} onClick={() => approveEvent(ev.id, true)}>Approve</button>
                  <button className="btn btn-danger" onClick={() => approveEvent(ev.id, false)}>Reject</button>
                </div>
              </div>
            ))}
            {myEvents.length > 0 && (
              <>
                <div style={{ fontSize:11, color:'var(--t4)', fontWeight:500, letterSpacing:'0.04em', textTransform:'uppercase', marginTop:8 }}>Managed</div>
                <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--line)', borderRadius:'var(--r2)', overflow:'hidden', border:'1px solid var(--line)' }}>
                  {myEvents.map(ev => (
                    <div key={ev.id} style={{ background:'var(--bg)', padding:'12px 16px', display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                          <span style={{ fontWeight:500, fontSize:13 }}>{ev.title}</span>
                          <span className={`badge status-${ev.status}`}>{ev.status.replace(/_/g,' ')}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{ev.event_date} · {ev.venue}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'od' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {odRequests.length === 0 && (
              <div className="card card-p" style={{ textAlign:'center', color:'var(--t3)', fontSize:13 }}>No OD requests pending.</div>
            )}
            {odRequests.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} className="acard">
                  <div className="acard-head">
                    <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{reg?.full_name}</div>
                        <div style={{ fontSize:12, color:'var(--t3)' }}>{reg?.reg_number} · {reg?.department} · {reg?.year_sem}</div>
                        <div style={{ fontSize:12, color:'var(--t4)', marginTop:2 }}>{ev?.title} · {ev?.event_date} · {reg?.role_in_event}</div>
                      </div>
                      <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)', flexShrink:0 }}>{od.slip_id}</span>
                    </div>
                  </div>
                  <div className="acard-body">
                    <label className="lbl">Remarks (optional)</label>
                    <input className="inp" placeholder="Add remarks..." value={remarks[od.id]||''} onChange={e => setRemarks(r=>({...r,[od.id]:e.target.value}))} />
                  </div>
                  <div className="acard-foot">
                    <button className="btn btn-success" style={{ flex:1 }} onClick={() => approveOD(od.id, true)}>Approve OD</button>
                    <button className="btn btn-danger" onClick={() => approveOD(od.id, false)}>Reject</button>
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
