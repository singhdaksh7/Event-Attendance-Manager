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
  const [approved, setApproved] = useState<ODRequest[]>([])
  const [tab, setTab] = useState<'pending'|'approved'>('pending')
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
      if (!p || p.role !== 'hod') { router.push(p?.role === 'faculty' ? '/dashboard/faculty' : '/dashboard/student'); return }
      setProfile(p)
      const { data: pend } = await supabase.from('od_requests').select('*, event:event_id(title,event_date,venue,club_name), registration:registration_id(full_name,reg_number,department,year_sem,section,role_in_event,phone,email)').eq('hod_id', user.id).eq('faculty_status', 'approved').eq('hod_status', 'pending').order('created_at', { ascending: false })
      setPending(pend || [])
      const { data: app } = await supabase.from('od_requests').select('*, event:event_id(title,event_date), registration:registration_id(full_name,reg_number,department)').eq('hod_id', user.id).eq('hod_status', 'approved').order('hod_acted_at', { ascending: false }).limit(30)
      setApproved(app || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleOD(id: string, approve: boolean) {
    const od = pending.find(o => o.id === id)
    await supabase.from('od_requests').update({ hod_status: approve ? 'approved' : 'rejected', hod_remarks: remarks[id] || '', hod_acted_at: new Date().toISOString() }).eq('id', id)
    if (od) await supabase.from('event_registrations').update({ od_status: approve ? 'hod_approved' : 'rejected' }).eq('id', od.registration_id)
    toast.success(approve ? 'OD granted! Student can now download their OD slip.' : 'OD rejected.')
    const moved = pending.find(o => o.id === id)
    setPending(p => p.filter(o => o.id !== id))
    if (approve && moved) setApproved(p => [{ ...moved, hod_status: 'approved' as any }, ...p])
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>HOD Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>{profile.full_name} · {profile.department} · Final OD approvals</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '2rem' }}>
          {[
            { l: 'Awaiting your approval', v: pending.length,  c: '#fbbf24' },
            { l: 'Total ODs granted',      v: approved.length, c: 'var(--teal-light)' },
          ].map(s => <div key={s.l} className="stat-card"><div className="stat-num" style={{ color: s.c }}>{s.v}</div><div className="stat-lbl">{s.l}</div></div>)}
        </div>

        <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
          {(['pending','approved'] as const).map(t => (
            <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'pending' ? `Pending${pending.length > 0 ? ` (${pending.length})` : ''}` : `Approved (${approved.length})`}
            </button>
          ))}
        </div>

        {tab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
                All OD requests reviewed. Nothing pending.
              </div>
            )}
            {pending.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} className="approval-card fade-up" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="approval-card-head">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{reg?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>{reg?.reg_number} · {reg?.department} · {reg?.year_sem}{reg?.section ? ` · Sec ${reg.section}` : ''}</div>
                      {reg?.phone && <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 2 }}>📞 {reg.phone}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--indigo-light)', marginBottom: 4 }}>{od.slip_id}</div>
                      <span className="badge badge-indigo">Faculty approved</span>
                    </div>
                  </div>
                  <div className="approval-card-body">
                    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--indigo-light)', marginBottom: 6 }}>Event</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{ev?.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>📅 {ev?.event_date} · 📍 {ev?.venue}</div>
                      <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 3 }}>{ev?.club_name} · Role: {reg?.role_in_event}</div>
                    </div>
                    <label className="lbl">HOD remarks (optional)</label>
                    <input className="inp" placeholder="Add remarks..." value={remarks[od.id] || ''} onChange={e => setRemarks(r => ({ ...r, [od.id]: e.target.value }))} />
                  </div>
                  <div className="approval-card-foot">
                    <button className="btn btn-teal" style={{ flex: 1, fontWeight: 700 }} onClick={() => handleOD(od.id, true)}>✓ Grant OD</button>
                    <button className="btn btn-danger" onClick={() => handleOD(od.id, false)}>✕ Reject</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'approved' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approved.length === 0 && <div className="card" style={{ padding: '2.5rem', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>No approved ODs yet.</div>}
            {approved.map(od => {
              const reg = od.registration as any; const ev = od.event as any
              return (
                <div key={od.id} className="card card-hover" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{reg?.full_name}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--t4)' }}>{reg?.reg_number}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{ev?.title} · {ev?.event_date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--indigo-light)' }}>{od.slip_id}</span>
                    <span className="badge badge-teal">OD granted</span>
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
