'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { ODRequest, EventRegistration, Event } from '@/lib/types'

export default function ODSlipPage() {
  const [od, setOd] = useState<ODRequest | null>(null)
  const [reg, setReg] = useState<EventRegistration | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const registrationId = params.registrationId as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: odData } = await supabase.from('od_requests').select('*').eq('registration_id', registrationId).eq('hod_status', 'approved').single()
      if (!odData) { setNotFound(true); setLoading(false); return }
      setOd(odData)
      const { data: regData } = await supabase.from('event_registrations').select('*').eq('id', registrationId).single()
      setReg(regData)
      const { data: evData } = await supabase.from('events').select('*, faculty:faculty_id(full_name,department), hod:hod_id(full_name,department), organizer:organizer_id(full_name)').eq('id', regData?.event_id).single()
      setEvent(evData)
      setLoading(false)
    }
    load()
  }, [registrationId])

  const fmt = (d: string) => { if (!d) return ''; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) }
  const typeLabel: Record<string,string> = { technical:'Technical', hackathon:'Hackathon', cultural:'Cultural', sports:'Sports', other:'Other' }

  if (loading) return <div className="page-bg min-h-screen flex items-center justify-center"><div style={{ color: 'var(--t4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading OD slip...</div></div>

  if (notFound) return (
    <div className="page-bg min-h-screen flex items-center justify-center px-4">
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>OD slip not ready</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>The OD hasn't been fully approved yet, or this slip doesn't exist.</p>
        <Link href="/dashboard/student"><button className="btn btn-ghost btn-sm">Go to dashboard</button></Link>
      </div>
    </div>
  )

  if (!od || !reg || !event) return null

  return (
    <div className="page-bg min-h-screen py-8 px-4">
      {/* Controls */}
      <div className="no-print container-app" style={{ maxWidth: 720, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/dashboard/student" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>← Dashboard</Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
        </div>
      </div>

      {/* ── SLIP (white, prints cleanly) ── */}
      <div id="od-slip" style={{ maxWidth: 720, margin: '0 auto', background: '#fff', color: '#111', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* Slip header */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a3e 0%, #0f0f2e 100%)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(129,140,248,0.2)', border: '1px solid rgba(129,140,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontSize: 22, fontWeight: 800, flexShrink: 0, fontFamily: 'Syne, sans-serif' }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800, color: '#f0f0ff', letterSpacing: '-0.02em' }}>SRM Institute of Science and Technology</div>
            <div style={{ fontSize: 11, color: 'rgba(160,160,192,0.8)', marginTop: 2 }}>Kattankulathur, Chennai — Deemed to be University (Under Section 3 of UGC Act 1956)</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#818cf8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>On Duty</div>
            <div style={{ fontSize: 10, color: 'rgba(160,160,192,0.6)', marginTop: 4, fontFamily: 'monospace' }}>{od.slip_id}</div>
          </div>
        </div>

        {/* Certificate title */}
        <div style={{ borderBottom: '2px solid #1a1a3e', padding: '1rem 2rem', textAlign: 'center', background: '#fafafe' }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1a1a3e', fontFamily: 'Syne, sans-serif' }}>On Duty Certificate</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>This certificate is issued upon completion of the approval process</div>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: '1.5rem', background: '#f9f9ff', borderLeft: '3px solid #6366f1', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>
            This is to certify that the following student has participated in the event mentioned below and is hereby granted <strong>On Duty (OD)</strong> status. This certificate has been duly approved by the Faculty In-charge and the Head of Department.
          </p>

          {/* Two column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Student */}
            <div style={{ background: '#f5f4ff', border: '1px solid #e0deff', borderRadius: 10, padding: '1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: 10 }}>Student details</div>
              <SlipRow label="Name" value={reg.full_name} />
              <SlipRow label="Register No." value={reg.reg_number} mono />
              <SlipRow label="Department" value={reg.department} />
              <SlipRow label="Year / Semester" value={reg.year_sem} />
              {reg.section && <SlipRow label="Section" value={reg.section} />}
              {reg.phone && <SlipRow label="Phone" value={reg.phone} />}
              {reg.email && <SlipRow label="Email" value={reg.email} />}
            </div>

            {/* Event */}
            <div style={{ background: '#f0fdf9', border: '1px solid #ccfbf1', borderRadius: 10, padding: '1rem' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#059669', marginBottom: 10 }}>Event details</div>
              <SlipRow label="Event" value={event.title} />
              <SlipRow label="Club" value={event.club_name} />
              <SlipRow label="Type" value={typeLabel[event.event_type] || event.event_type} />
              <SlipRow label="Date" value={fmt(event.event_date)} />
              <SlipRow label="Venue" value={event.venue} />
              <SlipRow label="Role" value={reg.role_in_event} />
              {event.start_time && <SlipRow label="Time" value={`${event.start_time}${event.end_time ? ' – ' + event.end_time : ''}`} />}
            </div>
          </div>

          {/* Approval */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b45309', marginBottom: 10 }}>Approval details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <SlipRow label="Faculty In-charge" value={(event.faculty as any)?.full_name || '—'} />
              <SlipRow label="Faculty Dept." value={(event.faculty as any)?.department || '—'} />
              <SlipRow label="Head of Department" value={(event.hod as any)?.full_name || '—'} />
              <SlipRow label="HOD Dept." value={(event.hod as any)?.department || '—'} />
              {od.faculty_remarks && <SlipRow label="Faculty remarks" value={od.faculty_remarks} />}
              {od.hod_remarks && <SlipRow label="HOD remarks" value={od.hod_remarks} />}
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #d1d5db' }}>
            {[
              { lbl: 'Student Signature', name: reg.full_name },
              { lbl: 'Faculty In-charge', name: (event.faculty as any)?.full_name || '' },
              { lbl: 'Head of Department', name: (event.hod as any)?.full_name || '' },
            ].map(s => (
              <div key={s.lbl} style={{ textAlign: 'center' }}>
                <div style={{ height: 44, borderBottom: '1.5px solid #374151', marginBottom: 6 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: 'Syne, sans-serif' }}>{s.lbl}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{s.name}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6', fontSize: 10, color: '#9ca3af' }}>
            <div>
              <span style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 700 }}>{od.slip_id}</span>
              <span> · Issued {fmt(od.created_at)}</span>
            </div>
            <span>EventOD · SRM Institute of Science and Technology</span>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ maxWidth: 720, margin: '1rem auto', textAlign: 'center', fontSize: 12, color: 'var(--t4)' }}>
        Press <kbd style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Ctrl+P</kbd> or <kbd style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Cmd+P</kbd> to print or save as PDF
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          #od-slip { border-radius: 0 !important; border: none !important; max-width: 100% !important; }
          * { -webkit-print-color-adjust: exact; color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

function SlipRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#111827', textAlign: 'right', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}
