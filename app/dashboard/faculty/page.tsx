'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, Event, ODRequest } from '@/lib/types'

// Returns true if the event's end_time on event_date is in the past
function isDeadlinePassed(eventDate: string, endTime?: string | null) {
  if (!endTime) return false
  const deadline = new Date(`${eventDate}T${endTime}`)
  return new Date() > deadline
}

function downloadCSV(rows: Record<string, string>[], filename: string) {
  if (!rows.length) { return }
  const headers = Object.keys(rows[0])
  const escape  = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface ODWithDetails extends Omit<ODRequest, 'event' | 'registration'> {
  event: Event & { start_time?: string; end_time?: string }
  registration: { full_name: string; reg_number: string; department: string; year_sem: string; role_in_event: string }
}

interface GrantedOD extends Omit<ODRequest, 'event' | 'registration'> {
  event: { title: string; event_date: string; venue: string }
  registration: { full_name: string; reg_number: string; department: string; year_sem: string; role_in_event: string }
}

export default function FacultyDashboard() {
  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [tab,           setTab]           = useState<'events'|'od'|'granted'>('events')
  const [pendingEvents, setPendingEvents] = useState<Event[]>([])
  const [myEvents,      setMyEvents]      = useState<Event[]>([])
  const [odRequests,    setOdRequests]    = useState<ODWithDetails[]>([])
  const [grantedODs,    setGrantedODs]    = useState<GrantedOD[]>([])
  const [remarks,       setRemarks]       = useState<Record<string,string>>({})
  const [loading,       setLoading]       = useState(true)

  // Per-event expanded state and selected checkboxes
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [selected,      setSelected]      = useState<Record<string, Set<string>>>({})  // eventId → Set of od ids

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
      await loadData(user.id)
      setLoading(false)
    }
    load()
  }, [])

  async function loadData(userId: string) {
    const [{ data: pend }, { data: all }, { data: ods }, { data: granted }] = await Promise.all([
      supabase.from('events').select('*, organizer:organizer_id(full_name,reg_number,department)').eq('faculty_id', userId).eq('status','pending_approval').order('created_at',{ascending:false}),
      supabase.from('events').select('*, organizer:organizer_id(full_name)').eq('faculty_id', userId).neq('status','pending_approval').order('created_at',{ascending:false}),
      supabase.from('od_requests').select('*, event:event_id(title,event_date,venue,start_time,end_time), registration:registration_id(full_name,reg_number,department,year_sem,role_in_event)').eq('faculty_id', userId).eq('faculty_status','pending').order('created_at',{ascending:false}),
      supabase.from('od_requests').select('*, event:event_id(title,event_date,venue), registration:registration_id(full_name,reg_number,department,year_sem,role_in_event)').eq('faculty_id', userId).eq('hod_status','approved').order('hod_acted_at',{ascending:false}).limit(200),
    ])
    setPendingEvents(pend || [])
    setMyEvents(all || [])
    setOdRequests((ods || []) as ODWithDetails[])
    setGrantedODs((granted || []) as GrantedOD[])
  }

  async function approveEvent(id: string, approve: boolean) {
    await supabase.from('events').update({ status: approve ? 'approved' : 'rejected', faculty_remarks: remarks[id] || '' }).eq('id', id)
    toast.success(approve ? 'Event approved' : 'Event rejected')
    setPendingEvents(p => p.filter(e => e.id !== id))
    if (approve) {
      const { data: ev } = await supabase.from('events').select('*, organizer:organizer_id(full_name)').eq('id', id).single()
      if (ev) setMyEvents(p => [ev, ...p])
    }
  }

  async function approveOD(ids: string[], approve: boolean) {
    await Promise.all(ids.map(async id => {
      const od = odRequests.find(o => o.id === id)
      await supabase.from('od_requests').update({ faculty_status: approve ? 'approved' : 'rejected', faculty_remarks: remarks[id] || '', faculty_acted_at: new Date().toISOString() }).eq('id', id)
      if (od) await supabase.from('event_registrations').update({ od_status: approve ? 'faculty_approved' : 'rejected' }).eq('id', od.registration_id)
    }))
    toast.success(approve
      ? `${ids.length} OD${ids.length > 1 ? 's' : ''} approved → forwarded to HOD`
      : `${ids.length} OD${ids.length > 1 ? 's' : ''} rejected`)
    setOdRequests(p => p.filter(o => !ids.includes(o.id)))
    setSelected({})
  }

  // Group OD requests by event
  const odByEvent: Record<string, ODWithDetails[]> = {}
  for (const od of odRequests) {
    const eid = od.event_id
    if (!odByEvent[eid]) odByEvent[eid] = []
    odByEvent[eid].push(od)
  }

  function toggleSelect(eventId: string, odId: string) {
    setSelected(prev => {
      const set = new Set(prev[eventId] || [])
      if (set.has(odId)) set.delete(odId); else set.add(odId)
      return { ...prev, [eventId]: set }
    })
  }

  function toggleSelectAll(eventId: string, allIds: string[]) {
    setSelected(prev => {
      const set = prev[eventId] || new Set<string>()
      const allSelected = allIds.every(id => set.has(id))
      return { ...prev, [eventId]: allSelected ? new Set() : new Set(allIds) }
    })
  }

  if (loading || !profile) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="loading-dots">
        {[0,1,2].map(i => <div key={i} className="loading-dot" style={{ animationDelay:`${i*0.2}s` }} />)}
      </div>
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

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:8, marginBottom:28 }}>
          {[
            { l:'Event approvals', v:pendingEvents.length, c: pendingEvents.length > 0 ? '#fbbf24' : 'var(--t1)' },
            { l:'Events managed',  v:myEvents.length,      c: 'var(--t1)' },
            { l:'OD pending',      v:odRequests.length,    c: odRequests.length > 0 ? '#fbbf24' : 'var(--t1)' },
            { l:'OD granted',      v:grantedODs.length,    c: grantedODs.length > 0 ? '#34d399' : 'var(--t1)' },
          ].map(s => <div key={s.l} className="stat"><div className="stat-n" style={{ color: s.c }}>{s.v}</div><div className="stat-l">{s.l}</div></div>)}
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          <button className={`tab-btn ${tab==='events'?'on':''}`} onClick={() => setTab('events')}>
            Event approvals{pendingEvents.length>0?` (${pendingEvents.length})`:''}
          </button>
          <button className={`tab-btn ${tab==='od'?'on':''}`} onClick={() => setTab('od')}>
            OD requests{odRequests.length>0?` (${odRequests.length})`:''}
          </button>
          <button className={`tab-btn ${tab==='granted'?'on':''}`} onClick={() => setTab('granted')}>
            Granted ODs{grantedODs.length>0?` (${grantedODs.length})`:''}
          </button>
        </div>

        {/* ── EVENTS TAB ── */}
        {tab === 'events' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {pendingEvents.length === 0 && myEvents.length === 0 && (
              <div className="card empty-state">
                <div className="empty-state-icon">📋</div>
                No events assigned yet.
              </div>
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

        {/* ── OD TAB ── */}
        {tab === 'od' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {odRequests.length === 0 && (
              <div className="card empty-state">
                <div className="empty-state-icon">✅</div>
                No OD requests pending.
              </div>
            )}

            {Object.entries(odByEvent).map(([eventId, ods]) => {
              const ev        = ods[0].event as any
              const passed    = isDeadlinePassed(ev.event_date, ev.end_time)
              const isOpen    = expandedEvent === eventId
              const allIds    = ods.map(o => o.id)
              const selSet    = selected[eventId] || new Set<string>()
              const allChecked = allIds.length > 0 && allIds.every(id => selSet.has(id))
              const someChecked = allIds.some(id => selSet.has(id))

              return (
                <div key={eventId} className="card" style={{ overflow:'hidden' }}>
                  {/* Event header row */}
                  <div
                    onClick={() => setExpandedEvent(isOpen ? null : eventId)}
                    style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderBottom: isOpen ? '1px solid var(--line)' : 'none' }}
                  >
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                        <span style={{ fontWeight:600, fontSize:14 }}>{ev.title}</span>
                        <span className="badge badge-gray" style={{ fontSize:10 }}>{ods.length} pending</span>
                        {passed
                          ? <span className="badge badge-red" style={{ fontSize:10 }}>Deadline passed</span>
                          : ev.end_time
                            ? <span className="badge badge-green" style={{ fontSize:10 }}>Open until {ev.end_time}</span>
                            : null}
                      </div>
                      <div style={{ fontSize:12, color:'var(--t3)' }}>
                        {ev.event_date}{ev.start_time ? ` · ${ev.start_time}` : ''}{ev.end_time ? ` – ${ev.end_time}` : ''}{ev.venue ? ` · ${ev.venue}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize:12, color:'var(--t3)', flexShrink:0 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded student list */}
                  {isOpen && (
                    <div>
                      {/* Bulk actions bar */}
                      <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10, background:'var(--bg-1)', flexWrap:'wrap' }}>
                        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, fontWeight:500 }}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={() => toggleSelectAll(eventId, allIds)}
                            style={{ width:14, height:14, cursor:'pointer' }}
                          />
                          Select all ({allIds.length})
                        </label>
                        <div style={{ flex:1 }} />
                        {!passed && selSet.size > 0 && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => approveOD(Array.from(selSet), true)}
                            >
                              Approve {selSet.size} selected
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => approveOD(Array.from(selSet), false)}
                            >
                              Reject selected
                            </button>
                          </>
                        )}
                        {passed && (
                          <span style={{ fontSize:11, color:'#f87171' }}>Approval window closed — event has ended</span>
                        )}
                      </div>

                      {/* Student rows */}
                      {ods.map(od => {
                        const reg = od.registration as any
                        const isChecked = selSet.has(od.id)
                        return (
                          <div
                            key={od.id}
                            onClick={() => !passed && toggleSelect(eventId, od.id)}
                            style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:12, cursor: passed ? 'default' : 'pointer', background: isChecked ? 'rgba(124,58,237,0.05)' : 'transparent', opacity: passed ? 0.6 : 1 }}
                          >
                            {!passed && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelect(eventId, od.id)}
                                onClick={e => e.stopPropagation()}
                                style={{ width:14, height:14, cursor:'pointer', flexShrink:0 }}
                              />
                            )}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:2 }}>
                                <span style={{ fontWeight:500, fontSize:13 }}>{reg?.full_name}</span>
                                <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{reg?.reg_number}</span>
                                <span className="badge badge-gray" style={{ fontSize:10 }}>{reg?.role_in_event}</span>
                              </div>
                              <div style={{ fontSize:11, color:'var(--t3)' }}>{reg?.department} · {reg?.year_sem}</div>
                            </div>
                            <span style={{ fontFamily:'monospace', fontSize:10, color:'var(--t4)', flexShrink:0 }}>{od.slip_id}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── GRANTED ODs TAB ── */}
        {tab === 'granted' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <p style={{ fontSize:13, color:'var(--t3)', margin:0 }}>
                ODs you forwarded that have been granted by the HOD
              </p>
              {grantedODs.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const rows = grantedODs.map(od => ({
                      'Slip ID':        od.slip_id,
                      'Student Name':   (od.registration as any)?.full_name ?? '',
                      'Reg Number':     (od.registration as any)?.reg_number ?? '',
                      'Department':     (od.registration as any)?.department ?? '',
                      'Year / Sem':     (od.registration as any)?.year_sem ?? '',
                      'Role in Event':  (od.registration as any)?.role_in_event ?? '',
                      'Event':          (od.event as any)?.title ?? '',
                      'Event Date':     (od.event as any)?.event_date ?? '',
                      'Venue':          (od.event as any)?.venue ?? '',
                      'HOD Granted At': od.hod_acted_at ? new Date(od.hod_acted_at).toLocaleString('en-IN') : '',
                    }))
                    downloadCSV(rows, `granted-od-list-${new Date().toISOString().slice(0,10)}.csv`)
                  }}
                >
                  ↓ Download CSV ({grantedODs.length})
                </button>
              )}
            </div>

            {grantedODs.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">📄</div>
                No ODs have been granted by the HOD yet.
              </div>
            ) : (
              <div className="card" style={{ overflow:'hidden' }}>
                <div style={{ overflowX:'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Reg No.</th>
                        <th>Dept · Year</th>
                        <th>Role</th>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Slip ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grantedODs.map(od => {
                        const reg = od.registration as any
                        const ev  = od.event as any
                        return (
                          <tr key={od.id}>
                            <td style={{ fontWeight:500 }}>{reg?.full_name}</td>
                            <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{reg?.reg_number}</td>
                            <td style={{ fontSize:12, color:'var(--t3)' }}>{reg?.department} · {reg?.year_sem}</td>
                            <td><span className="badge badge-gray" style={{ fontSize:10 }}>{reg?.role_in_event}</span></td>
                            <td style={{ fontSize:12 }}>{ev?.title}</td>
                            <td style={{ fontSize:12, color:'var(--t3)', whiteSpace:'nowrap' }}>{ev?.event_date}</td>
                            <td style={{ fontFamily:'monospace', fontSize:10, color:'var(--t4)' }}>{od.slip_id}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
