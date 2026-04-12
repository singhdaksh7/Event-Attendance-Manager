'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile, ODRequest } from '@/lib/types'

function isDeadlinePassed(eventDate: string, endTime?: string | null) {
  if (!endTime) return false
  const deadline = new Date(`${eventDate}T${endTime}`)
  return new Date() > deadline
}

function downloadCSV(rows: Record<string, string>[], filename: string) {
  if (!rows.length) return
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
  event: { title: string; event_date: string; venue: string; club_name: string; start_time?: string; end_time?: string }
  registration: { full_name: string; reg_number: string; department: string; year_sem: string; section?: string; role_in_event: string; phone?: string }
}

export default function HODDashboard() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [pending,  setPending]  = useState<ODWithDetails[]>([])
  const [approved, setApproved] = useState<ODWithDetails[]>([])
  const [tab,      setTab]      = useState<'pending'|'approved'>('pending')
  const [remarks,  setRemarks]  = useState<Record<string,string>>({})

  // Per-event expand + selection
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [selected,      setSelected]      = useState<Record<string, Set<string>>>({})

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
      await loadData(user.id)
    }
    load()
  }, [])

  async function loadData(userId: string) {
    const [{ data: pend }, { data: done }] = await Promise.all([
      supabase.from('od_requests').select('*, event:event_id(title,event_date,venue,club_name,start_time,end_time), registration:registration_id(full_name,reg_number,department,year_sem,section,role_in_event,phone)').eq('hod_id', userId).eq('faculty_status','approved').eq('hod_status','pending').order('created_at',{ascending:false}),
      supabase.from('od_requests').select('*, event:event_id(title,event_date,venue,club_name), registration:registration_id(full_name,reg_number,department)').eq('hod_id', userId).eq('hod_status','approved').order('hod_acted_at',{ascending:false}).limit(50),
    ])
    setPending((pend || []) as ODWithDetails[])
    setApproved((done || []) as ODWithDetails[])
  }

  async function handleOD(ids: string[], approve: boolean) {
    await Promise.all(ids.map(async id => {
      const od = pending.find(o => o.id === id)
      await supabase.from('od_requests').update({ hod_status: approve ? 'approved' : 'rejected', hod_remarks: remarks[id] || '', hod_acted_at: new Date().toISOString() }).eq('id', id)
      if (od) await supabase.from('event_registrations').update({ od_status: approve ? 'hod_approved' : 'rejected' }).eq('id', od.registration_id)
    }))
    toast.success(approve
      ? `OD granted for ${ids.length} student${ids.length > 1 ? 's' : ''} — slip downloadable`
      : `${ids.length} OD${ids.length > 1 ? 's' : ''} rejected`)
    const moved = pending.filter(o => ids.includes(o.id))
    setPending(p => p.filter(o => !ids.includes(o.id)))
    if (approve) setApproved(p => [...moved.map(m => ({ ...m, hod_status: 'approved' as any })), ...p])
    setSelected({})
  }

  // Group pending by event
  const byEvent: Record<string, ODWithDetails[]> = {}
  for (const od of pending) {
    if (!byEvent[od.event_id]) byEvent[od.event_id] = []
    byEvent[od.event_id].push(od)
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

  if (!profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ marginBottom:28 }}>
          <h1>HOD Dashboard</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>{profile.full_name} · {profile.department}</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:8, marginBottom:28 }}>
          <div className="stat"><div className="stat-n" style={{ color: pending.length > 0 ? '#fbbf24' : 'var(--t1)' }}>{pending.length}</div><div className="stat-l">Pending approvals</div></div>
          <div className="stat"><div className="stat-n" style={{ color: approved.length > 0 ? '#34d399' : 'var(--t1)' }}>{approved.length}</div><div className="stat-l">Total granted</div></div>
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          {(['pending','approved'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab===t?'on':''}`} onClick={() => setTab(t)}>
              {t === 'pending' ? `Pending${pending.length>0?` (${pending.length})`:''}`:`Approved (${approved.length})`}
            </button>
          ))}
        </div>

        {/* ── PENDING TAB ── */}
        {tab === 'pending' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {pending.length === 0 && (
              <div className="card empty-state">
                <div className="empty-state-icon">✅</div>
                Nothing pending. All clear.
              </div>
            )}

            {Object.entries(byEvent).map(([eventId, ods]) => {
              const ev         = ods[0].event as any
              const passed     = isDeadlinePassed(ev.event_date, ev.end_time)
              const isOpen     = expandedEvent === eventId
              const allIds     = ods.map(o => o.id)
              const selSet     = selected[eventId] || new Set<string>()
              const allChecked = allIds.length > 0 && allIds.every(id => selSet.has(id))
              const someChecked = allIds.some(id => selSet.has(id))

              return (
                <div key={eventId} className="card" style={{ overflow:'hidden' }}>
                  {/* Event header */}
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
                        {ev.event_date}{ev.start_time ? ` · ${ev.start_time}` : ''}{ev.end_time ? ` – ${ev.end_time}` : ''}{ev.venue ? ` · ${ev.venue}` : ''}{ev.club_name ? ` · ${ev.club_name}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize:12, color:'var(--t3)', flexShrink:0 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

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
                              onClick={() => handleOD(Array.from(selSet), true)}
                            >
                              Grant OD for {selSet.size} selected
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOD(Array.from(selSet), false)}
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
                        const reg       = od.registration as any
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
                              <div style={{ fontSize:11, color:'var(--t3)' }}>
                                {reg?.department} · {reg?.year_sem}{reg?.section ? ` · ${reg.section}` : ''}
                                {reg?.phone ? ` · ${reg.phone}` : ''}
                              </div>
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

        {/* ── APPROVED TAB ── */}
        {tab === 'approved' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <p style={{ fontSize:13, color:'var(--t3)', margin:0 }}>All ODs granted by you</p>
              {approved.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const rows = approved.map(od => ({
                      'Slip ID':        od.slip_id,
                      'Student Name':   (od.registration as any)?.full_name ?? '',
                      'Reg Number':     (od.registration as any)?.reg_number ?? '',
                      'Department':     (od.registration as any)?.department ?? '',
                      'Year / Sem':     (od.registration as any)?.year_sem ?? '',
                      'Section':        (od.registration as any)?.section ?? '',
                      'Phone':          (od.registration as any)?.phone ?? '',
                      'Role in Event':  (od.registration as any)?.role_in_event ?? '',
                      'Event':          (od.event as any)?.title ?? '',
                      'Event Date':     (od.event as any)?.event_date ?? '',
                      'Venue':          (od.event as any)?.venue ?? '',
                      'Club':           (od.event as any)?.club_name ?? '',
                      'HOD Granted At': od.hod_acted_at ? new Date(od.hod_acted_at).toLocaleString('en-IN') : '',
                    }))
                    downloadCSV(rows, `granted-od-list-${new Date().toISOString().slice(0,10)}.csv`)
                  }}
                >
                  ↓ Download CSV ({approved.length})
                </button>
              )}
            </div>

            {approved.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">📄</div>
                No ODs granted yet.
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
                        <th>Section</th>
                        <th>Role</th>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Slip ID</th>
                        <th>Granted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map(od => {
                        const reg = od.registration as any
                        const ev  = od.event as any
                        return (
                          <tr key={od.id}>
                            <td style={{ fontWeight:500 }}>{reg?.full_name}</td>
                            <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{reg?.reg_number}</td>
                            <td style={{ fontSize:12, color:'var(--t3)' }}>{reg?.department} · {reg?.year_sem}</td>
                            <td style={{ fontSize:12, color:'var(--t3)' }}>{reg?.section || '—'}</td>
                            <td><span className="badge badge-gray" style={{ fontSize:10 }}>{reg?.role_in_event}</span></td>
                            <td style={{ fontSize:12 }}>{ev?.title}</td>
                            <td style={{ fontSize:12, color:'var(--t3)', whiteSpace:'nowrap' }}>{ev?.event_date}</td>
                            <td style={{ fontFamily:'monospace', fontSize:10, color:'var(--t4)' }}>{od.slip_id}</td>
                            <td style={{ fontSize:11, color:'var(--t3)', whiteSpace:'nowrap' }}>
                              {od.hod_acted_at ? new Date(od.hod_acted_at).toLocaleString('en-IN', { dateStyle:'short', timeStyle:'short' }) : '—'}
                            </td>
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
