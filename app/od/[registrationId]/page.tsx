'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ODRequest, EventRegistration, Event } from '@/lib/types'

export default function ODSlipPage() {
  const [od,      setOd]      = useState<ODRequest | null>(null)
  const [reg,     setReg]     = useState<EventRegistration | null>(null)
  const [event,   setEvent]   = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound,setNotFound]= useState(false)
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const regId    = params.registrationId as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: odData } = await supabase.from('od_requests').select('*').eq('registration_id', regId).eq('hod_status','approved').single()
      if (!odData) { setNotFound(true); setLoading(false); return }
      setOd(odData)
      const { data: regData } = await supabase.from('event_registrations').select('*').eq('id', regId).single()
      setReg(regData)
      const { data: evData } = await supabase.from('events').select('*, faculty:faculty_id(full_name,department), hod:hod_id(full_name,department)').eq('id', regData?.event_id).single()
      setEvent(evData)
      setLoading(false)
    }
    load()
  }, [regId])

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) : ''
  const typeLabel: Record<string,string> = { technical:'Technical', hackathon:'Hackathon', cultural:'Cultural', sports:'Sports', other:'Other' }

  if (loading) return <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:20, height:20, border:'2px solid var(--bg-3)', borderTopColor:'#8b5cf6', borderRadius:'50%', animation:'spinning 0.6s linear infinite' }}/><style>{`@keyframes spinning{to{transform:rotate(360deg)}}`}</style></div>

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card card-p" style={{ maxWidth:340, textAlign:'center' }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:6 }}>OD slip not ready</div>
        <div style={{ fontSize:12, color:'var(--t3)', marginBottom:16 }}>Not approved yet or doesn't exist.</div>
        <Link href="/dashboard/student"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
      </div>
    </div>
  )

  if (!od || !reg || !event) return null

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'32px 20px' }}>
      {/* Controls */}
      <div className="no-print" style={{ maxWidth:680, margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link href="/dashboard/student" className="back-link">← Dashboard</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      {/* OD Slip — white, prints cleanly */}
      <div id="od-slip" style={{ maxWidth:680, margin:'0 auto', background:'#fff', color:'#111', borderRadius:12, overflow:'hidden', border:'1px solid #e5e7eb', fontFamily:'ui-sans-serif,system-ui,sans-serif' }}>
        {/* Header */}
        <div style={{ background:'#111', padding:'20px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#fff', letterSpacing:'-0.02em' }}>SRM Institute of Science and Technology</div>
            <div style={{ fontSize:11, color:'#666', marginTop:2 }}>Kattankulathur, Chennai — Deemed to be University</div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#888', letterSpacing:'0.1em', textTransform:'uppercase' }}>On Duty</div>
            <div style={{ fontSize:10, fontFamily:'monospace', color:'#555', marginTop:2 }}>{od.slip_id}</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'24px 28px' }}>
          <div style={{ textAlign:'center', marginBottom:20, paddingBottom:16, borderBottom:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#111' }}>On Duty Certificate</div>
            <div style={{ fontSize:11, color:'#888', marginTop:3 }}>This certificate is issued upon completion of the approval process</div>
          </div>

          <p style={{ fontSize:12, color:'#444', lineHeight:1.7, marginBottom:20, padding:'10px 14px', background:'#f9fafb', borderLeft:'3px solid #111', borderRadius:'0 6px 6px 0' }}>
            This is to certify that the student below participated in the mentioned event and is granted <strong>On Duty (OD)</strong> status, approved by the Faculty In-charge and Head of Department.
          </p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
            {/* Student */}
            <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#888', marginBottom:10 }}>Student</div>
              {[
                ['Name',           reg.full_name],
                ['Register No.',   reg.reg_number],
                ['Department',     reg.department],
                ['Year / Sem',     reg.year_sem],
                reg.section && ['Section', reg.section],
                reg.phone   && ['Phone',   reg.phone],
              ].filter(Boolean).map(([l,v]: any) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #f0f0f0', gap:8 }}>
                  <span style={{ fontSize:11, color:'#888' }}>{l}</span>
                  <span style={{ fontSize:11, fontWeight:600, textAlign:'right', fontFamily: l==='Register No.' ? 'monospace' : 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>
            {/* Event */}
            <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#888', marginBottom:10 }}>Event</div>
              {[
                ['Title',    event.title],
                ['Club',     event.club_name],
                ['Type',     typeLabel[event.event_type] || event.event_type],
                ['Date',     fmt(event.event_date)],
                ['Venue',    event.venue],
                ['Role',     reg.role_in_event],
                event.start_time && ['Time', `${event.start_time}${event.end_time ? ' – '+event.end_time :''}`],
              ].filter(Boolean).map(([l,v]: any) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #f0f0f0', gap:8 }}>
                  <span style={{ fontSize:11, color:'#888' }}>{l}</span>
                  <span style={{ fontSize:11, fontWeight:600, textAlign:'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Approval */}
          <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:14, marginBottom:24 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#888', marginBottom:10 }}>Approval</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                ['Faculty', (event.faculty as any)?.full_name || '—'],
                ['Dept.',   (event.faculty as any)?.department || '—'],
                ['HOD',     (event.hod as any)?.full_name || '—'],
                ['Dept.',   (event.hod as any)?.department || '—'],
                od.faculty_remarks && ['Faculty remarks', od.faculty_remarks],
                od.hod_remarks    && ['HOD remarks',     od.hod_remarks],
              ].filter(Boolean).map(([l,v]: any) => (
                <div key={l+v} style={{ display:'flex', flexDirection:'column', gap:1 }}>
                  <span style={{ fontSize:10, color:'#aaa' }}>{l}</span>
                  <span style={{ fontSize:11, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, paddingTop:16, borderTop:'1px dashed #e5e7eb' }}>
            {[
              { l:'Student Signature',   n: reg.full_name },
              { l:'Faculty In-charge',   n: (event.faculty as any)?.full_name || '' },
              { l:'Head of Department',  n: (event.hod as any)?.full_name || '' },
            ].map(s => (
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ height:40, borderBottom:'1.5px solid #374151', marginBottom:6 }} />
                <div style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{s.l}</div>
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>{s.n}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16, paddingTop:12, borderTop:'1px solid #f0f0f0', fontSize:10, color:'#bbb' }}>
            <span><span style={{ fontFamily:'monospace', color:'#888' }}>{od.slip_id}</span> · Issued {fmt(od.created_at)}</span>
            <span>EventOD · SRM Institute of Science and Technology</span>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ maxWidth:680, margin:'12px auto', textAlign:'center', fontSize:12, color:'var(--t4)' }}>
        Use Ctrl+P / Cmd+P → Save as PDF
      </div>
      <style>{`@media print{body{background:#fff!important}.no-print{display:none!important}#od-slip{border-radius:0!important;border:none!important;max-width:100%!important}*{-webkit-print-color-adjust:exact;color-adjust:exact;print-color-adjust:exact}}`}</style>
    </div>
  )
}
