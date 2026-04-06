'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

const DAYS = ['','Mon','Tue','Wed','Thu','Fri']
const SLOTS = ['','9:30–10:20','10:20–11:10','11:20–12:10','12:10–1:00','2:10–3:00','3:00–3:50']

interface Notif {
  id: string
  event_id: string
  teacher_name: string
  teacher_email: string
  slot_id: number
  student_count: number
  student_list: { name: string; reg_number: string }[]
  scheduled_at: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
  error_message: string | null
  created_at: string
  event?: { title: string; event_date: string }
  section?: { display_name: string }
}

export default function NotificationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all'|'pending'|'sent'|'failed'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || (p.role !== 'faculty' && p.role !== 'hod')) { router.push('/dashboard/student'); return }
      setProfile(p)
      await loadNotifs()
      setLoading(false)
    }
    load()
  }, [])

  async function loadNotifs() {
    const { data } = await supabase
      .from('od_notifications')
      .select('*, event:event_id(title,event_date), section:section_id(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifs((data || []) as Notif[])
  }

  async function retryFailed(id: string) {
    await supabase.from('od_notifications').update({ status: 'pending', error_message: null }).eq('id', id)
    toast.success('Reset to pending — will retry on next cycle')
    await loadNotifs()
  }

  async function deleteNotif(id: string) {
    await supabase.from('od_notifications').delete().eq('id', id)
    await loadNotifs()
  }

  const filtered = filter === 'all' ? notifs : notifs.filter(n => n.status === filter)
  const counts = { all: notifs.length, pending: notifs.filter(n=>n.status==='pending').length, sent: notifs.filter(n=>n.status==='sent').length, failed: notifs.filter(n=>n.status==='failed').length }

  const statusBadge = (s: string) => {
    if (s === 'sent')    return <span className="badge badge-green">Sent</span>
    if (s === 'pending') return <span className="badge badge-amber">Pending</span>
    return <span className="badge badge-red">Failed</span>
  }

  if (loading || !profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:8 }}>
            <Link href="/admin/timetable" style={{ fontSize:12, color:'var(--t3)', textDecoration:'none' }}>← Timetable</Link>
            <button className="btn btn-ghost btn-sm" onClick={loadNotifs}>↺ Refresh</button>
          </div>
          <h1>OD Notifications</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>Email log — teacher notifications for student OD</p>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:20 }}>
          {(['all','pending','sent','failed'] as const).map(s => (
            <div key={s} className="stat" style={{ cursor:'pointer', borderColor: filter===s ? 'var(--accent-2)' : 'var(--line)' }} onClick={() => setFilter(s)}>
              <div className="stat-n" style={{ color: s==='sent'?'#34d399':s==='pending'?'#fbbf24':s==='failed'?'#f87171':'var(--t1)' }}>{counts[s]}</div>
              <div className="stat-l" style={{ textTransform:'capitalize' }}>{s}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ overflow:'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', fontSize:13, color:'var(--t3)' }}>
              {filter === 'all' ? 'No notifications yet. They appear when students are marked present.' : `No ${filter} notifications.`}
            </div>
          ) : (
            <div>
              {filtered.map(n => (
                <div key={n.id} style={{ borderBottom:'1px solid var(--line)' }}>
                  {/* Row */}
                  <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', flexWrap:'wrap' }}
                    onClick={() => setExpanded(expanded === n.id ? null : n.id)}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                        <span style={{ fontWeight:500, fontSize:13 }}>{n.teacher_name}</span>
                        {statusBadge(n.status)}
                        <span className="badge badge-gray" style={{ fontSize:10 }}>Slot {n.slot_id} ({SLOTS[n.slot_id]})</span>
                      </div>
                      <div style={{ fontSize:12, color:'var(--t3)' }}>
                        {(n.event as any)?.title} · {(n.event as any)?.event_date}
                        {(n.section as any) && ` · ${(n.section as any).display_name}`}
                      </div>
                      <div style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>{n.teacher_email} · {n.student_count} students</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      <div style={{ fontSize:11, color:'var(--t4)' }}>
                        Scheduled: {n.scheduled_at ? new Date(n.scheduled_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—'}
                      </div>
                      {n.sent_at && <div style={{ fontSize:11, color:'#34d399' }}>Sent: {new Date(n.sent_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</div>}
                      {n.status === 'failed' && <div style={{ fontSize:11, color:'#f87171' }}>Failed</div>}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expanded === n.id && (
                    <div style={{ padding:'0 16px 16px', borderTop:'1px solid var(--line)' }}>
                      {n.error_message && (
                        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--r)', padding:'8px 12px', fontSize:12, color:'#f87171', marginBottom:12, marginTop:12 }}>
                          Error: {n.error_message}
                        </div>
                      )}
                      {/* Student list */}
                      {n.student_list?.length > 0 && (
                        <div style={{ marginTop:12 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--t3)', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:6 }}>Students ({n.student_list.length})</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--line)', borderRadius:'var(--r)', overflow:'hidden' }}>
                            {n.student_list.map((s, i) => (
                              <div key={i} style={{ background:'var(--bg)', padding:'7px 12px', display:'flex', gap:16, fontSize:12 }}>
                                <span style={{ color:'var(--t4)', minWidth:20 }}>{i+1}</span>
                                <span style={{ fontWeight:500, flex:1 }}>{s.name}</span>
                                <span style={{ fontFamily:'monospace', color:'var(--t3)' }}>{s.reg_number}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8, marginTop:12 }}>
                        {n.status === 'failed' && <button className="btn btn-ghost btn-sm" onClick={() => retryFailed(n.id)}>↺ Retry</button>}
                        <button className="btn btn-danger btn-sm" onClick={() => deleteNotif(n.id)}>Delete</button>
                      </div>
                    </div>
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
