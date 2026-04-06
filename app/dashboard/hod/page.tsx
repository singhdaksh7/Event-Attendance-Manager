'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, ODRequest } from '@/lib/types'

export default function HODDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pending, setPending] = useState<ODRequest[]>([])
  const [approved,setApproved]= useState<ODRequest[]>([])
  const [tab,     setTab]     = useState<'pending'|'approved'>('pending')
  const [remarks, setRemarks] = useState<Record<string,string>>({})
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'hod') { router.push(p?.role === 'faculty' ? '/dashboard/faculty' : '/dashboard/student'); return }
      setProfile(p)
      const { data: pend } = await supabase.from('od_requests').select('*, event:event_id(title,event_date,venue,club_name), registration:registration_id(full_name,reg_number,department,year_sem,section,role_in_event,phone)').eq('hod_id', user.id).eq('faculty_status','approved').eq('hod_status','pending').order('created_at',{ascending:false})
      setPending(pend || [])
      const { data: done } = await supabase.from('od_requests').select('*, event:event_id(title,event_date), registration:registration_id(full_name,reg_number,department)').eq('hod_id', user.id).eq('hod_status','approved').order('hod_acted_at',{ascending:false}).limit(30)
      setApproved(done || [])
    }
    load()
  }, [])

  async function handleOD(id: string, approve: boolean) {
    const od = pending.find(o => o.id === id)
    await supabase.from('od_requests').update({ hod_status: approve ? 'approved' : 'rejected', hod_remarks: remarks[id]||'', hod_acted_at: new Date().toISOString() }).eq('id', id)
    if (od) await supabase.from('event_registrations').update({ od_status: approve ? 'hod_approved' : 'rejected' }).eq('id', od.registration_id)
    toast.success(approve ? 'OD granted — student can download slip' : 'OD rejected')
    const moved = pending.find(o => o.id === id)
    setPending(p => p.filter(o => o.id !== id))
    if (approve && moved) setApproved(p => [{ ...moved, hod_status: 'approved' as any }, ...p])
  }

  if (!profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ marginBottom:28 }}>
          <h1>HOD Dashboard</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>{profile.full_name} · {profile.department}</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:28 }}>
          <div className="stat"><div className="stat-n">{pending.length}</div><div className="stat-l">Pending approvals</div></div>
          <div className="stat"><div className="stat-n">{approved.length}</div><div className="stat-l">Total granted</div></div>
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          {(['pending','approved'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab===t?'on':''}`} onClick={() => setTab(t)}>
              {t === 'pending' ? `Pending${pending.length>0?` (${pending.length})`:''}`:`Approved (${approved.length})`}
            </button>
          ))}
        </div>

        {tab === 'pending' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {pending.length === 0 && (
              <div className="card card-p" style={{ textAlign:'center', color:'var(--t3)', fontSize:13 }}>Nothing pending. All clear.</div>
            )}
            {pending.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} className="acard">
                  <div className="acard-head">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{reg?.full_name}</div>
                        <div style={{ fontSize:12, color:'var(--t3)' }}>{reg?.reg_number} · {reg?.department} · {reg?.year_sem}{reg?.section ? ` · ${reg.section}`:''}</div>
                        {reg?.phone && <div style={{ fontSize:12, color:'var(--t4)', marginTop:1 }}>{reg.phone}</div>}
                        <div style={{ marginTop:8, padding:'8px 12px', background:'var(--bg-2)', borderRadius:'var(--r)', border:'1px solid var(--line)' }}>
                          <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{ev?.title}</div>
                          <div style={{ fontSize:11, color:'var(--t3)' }}>{ev?.event_date} · {ev?.venue} · {ev?.club_name}</div>
                          <div style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>Role: {reg?.role_in_event}</div>
                        </div>
                      </div>
                      <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)', flexShrink:0 }}>{od.slip_id}</span>
                    </div>
                  </div>
                  <div className="acard-body">
                    <label className="lbl">Remarks (optional)</label>
                    <input className="inp" placeholder="Add remarks..." value={remarks[od.id]||''} onChange={e => setRemarks(r=>({...r,[od.id]:e.target.value}))} />
                  </div>
                  <div className="acard-foot">
                    <button className="btn btn-success" style={{ flex:1, fontWeight:600 }} onClick={() => handleOD(od.id, true)}>Grant OD</button>
                    <button className="btn btn-danger" onClick={() => handleOD(od.id, false)}>Reject</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'approved' && (
          <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--line)', borderRadius:'var(--r2)', overflow:'hidden', border:'1px solid var(--line)' }}>
            {approved.length === 0 && <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--t3)' }}>No approved ODs yet.</div>}
            {approved.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} style={{ background:'var(--bg)', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:500, fontSize:13 }}>{reg?.full_name}</span>
                      <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{reg?.reg_number}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{ev?.title} · {ev?.event_date}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontFamily:'monospace', fontSize:10, color:'var(--t3)' }}>{od.slip_id}</span>
                    <span className="badge badge-green">Granted</span>
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
