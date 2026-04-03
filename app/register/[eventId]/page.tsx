'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { generateQRCode, generateAttendanceQRData } from '@/lib/qr'
import type { Event } from '@/lib/types'

export default function RegisterPage() {
  const [event, setEvent] = useState<Event | null>(null)
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [attendanceQR, setAttendanceQR] = useState('')   // base64 PNG — client-side only
  const [qrDataStr, setQrDataStr] = useState('')         // compact JSON stored in DB
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savedForm, setSavedForm] = useState({ full_name: '', reg_number: '', department: '', year_sem: '' })
  const [form, setForm] = useState({
    full_name: '', reg_number: '', department: '',
    year_sem: '', section: '', phone: '', email: '', role_in_event: 'Participant'
  })
  const params = useParams()
  const supabase = createClient()
  const eventId = params.eventId as string
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      // Fetch event (no auth required — public page)
      const { data: ev, error: evError } = await supabase
        .from('events').select('*')
        .eq('id', eventId).eq('status', 'approved')
        .single()

      if (evError || !ev) {
        console.error('Event fetch error:', evError?.message)
        setPageLoading(false)
        return
      }
      setEvent(ev)

      // Pre-fill if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (p) {
          setForm(f => ({
            ...f,
            full_name:   p.full_name   || '',
            email:       p.email       || '',
            reg_number:  p.reg_number  || '',
            department:  p.department  || '',
            phone:       p.phone       || '',
          }))
        }
      }
      setPageLoading(false)
    }
    load()
  }, [eventId])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.reg_number || !form.department || !form.year_sem) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)

    try {
      // Check already registered
      const { data: existing } = await supabase
        .from('event_registrations')
        .select('id, attendance_qr_data')
        .eq('event_id', eventId)
        .eq('reg_number', form.reg_number)
        .maybeSingle()   // use maybeSingle so it doesn't error when not found

      if (existing) {
        toast('Already registered! Showing your QR.', { icon: 'ℹ️' })
        // Re-generate QR from stored data string (no DB image needed)
        const qrData = existing.attendance_qr_data || generateAttendanceQRData(existing.id, form.reg_number)
        const qrImg  = await generateQRCode(qrData)
        setAttendanceQR(qrImg)
        setQrDataStr(qrData)
        setSavedForm({ full_name: form.full_name, reg_number: form.reg_number, department: form.department, year_sem: form.year_sem })
        setStep('done')
        setLoading(false)
        return
      }

      // Get current user id (nullable — anonymous registration allowed)
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      // INSERT registration
      const { data: reg, error: insertError } = await supabase
        .from('event_registrations')
        .insert({
          event_id:       eventId,
          student_id:     user?.id || null,
          full_name:      form.full_name,
          reg_number:     form.reg_number,
          department:     form.department,
          year_sem:       form.year_sem,
          section:        form.section   || null,
          phone:          form.phone     || null,
          email:          form.email     || null,
          role_in_event:  form.role_in_event,
        })
        .select('id')
        .single()

      if (insertError || !reg) {
        console.error('Insert error:', insertError)
        toast.error(insertError?.message || 'Registration failed. Try again.')
        setLoading(false)
        return
      }

      // Build the compact QR data string and save to DB
      const qrData = generateAttendanceQRData(reg.id, form.reg_number)

      const { error: updateError } = await supabase
        .from('event_registrations')
        .update({ attendance_qr_data: qrData })
        .eq('id', reg.id)

      if (updateError) {
        // Non-fatal — we still have the data client-side
        console.warn('Could not save QR data to DB:', updateError.message)
      }

      // Generate the visual QR image purely client-side — never needs to be saved
      const qrImg = await generateQRCode(qrData)

      setAttendanceQR(qrImg)
      setQrDataStr(qrData)
      setSavedForm({
        full_name:   form.full_name,
        reg_number:  form.reg_number,
        department:  form.department,
        year_sem:    form.year_sem,
      })
      setStep('done')
      toast.success('Registered! Save your QR code.')

    } catch (err: any) {
      console.error('Registration error:', err)
      toast.error('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  function downloadQR() {
    if (!attendanceQR) return
    const a = document.createElement('a')
    a.href = attendanceQR
    a.download = `attendance-qr-${savedForm.reg_number}.png`
    a.click()
  }

  // ── Loading / not found states ──────────────────────────────
  if (pageLoading) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t4)' }}>Loading event...</div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
      </div>
    </div>
  )

  if (!event) return (
    <div className="page-bg min-h-screen flex items-center justify-center px-4">
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Event not available</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>This event is not open for registration or the link is invalid.</p>
      </div>
    </div>
  )

  const typeIcon: Record<string,string> = { technical:'⚡', hackathon:'🚀', cultural:'🎭', sports:'🏆', other:'📌' }
  const typeBg:   Record<string,string> = { technical:'rgba(99,102,241,0.12)', hackathon:'rgba(244,114,182,0.12)', cultural:'rgba(251,191,36,0.12)', sports:'rgba(74,222,128,0.12)', other:'rgba(255,255,255,0.05)' }

  return (
    <div className="page-bg min-h-screen py-8 px-4">
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* Event info card */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderColor: 'var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: typeBg[event.event_type] || typeBg.other, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {typeIcon[event.event_type] || '📌'}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{event.title}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{event.club_name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--t3)' }}>
            <span>📅 {event.event_date}</span>
            <span>📍 {event.venue}</span>
          </div>
          {event.description && (
            <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 8, lineHeight: 1.5 }}>{event.description}</div>
          )}
        </div>

        {/* ── STEP 1: Form ── */}
        {step === 'form' && (
          <div className="card-accent" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Register for this event</h2>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Fill your details below. You'll receive a personal QR code to show at the venue for attendance.
            </p>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="lbl">Full name *</label>
                <input className="inp" placeholder="Your full name as per ID" value={form.full_name} onChange={e => set('full_name', e.target.value)} required autoComplete="name" />
              </div>

              <div>
                <label className="lbl">Register number *</label>
                <input className="inp"
                  placeholder="RA2111003010234"
                  value={form.reg_number}
                  onChange={e => set('reg_number', e.target.value.toUpperCase())}
                  required
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="lbl">Department *</label>
                  <input className="inp" placeholder="CSE" value={form.department} onChange={e => set('department', e.target.value)} required />
                </div>
                <div>
                  <label className="lbl">Section</label>
                  <input className="inp" placeholder="A / B / C" value={form.section} onChange={e => set('section', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="lbl">Year / Semester *</label>
                <input className="inp" placeholder="e.g. 3rd Year / Sem 5" value={form.year_sem} onChange={e => set('year_sem', e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label className="lbl">Phone</label>
                  <input className="inp" type="tel" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className="lbl">Email</label>
                  <input className="inp" type="email" placeholder="you@srmist.edu.in" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="lbl">Role in event</label>
                <select className="inp" value={form.role_in_event} onChange={e => set('role_in_event', e.target.value)}>
                  {['Participant','Presenter','Organizer','Volunteer','Speaker'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>

              <button
                className="btn btn-primary btn-full"
                style={{ marginTop: 8, height: 46, fontSize: 15 }}
                type="submit"
                disabled={loading}
              >
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Registering...
                    </span>
                  : 'Register & get my QR →'
                }
              </button>
            </form>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ── STEP 2: Success + QR ── */}
        {step === 'done' && (
          <div className="card-teal fade-up" style={{ padding: '2rem', textAlign: 'center' }}>
            {/* Success icon */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(45,212,191,0.15)', border: '2px solid rgba(45,212,191,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 1.25rem', boxShadow: '0 0 24px rgba(45,212,191,0.2)' }}>
              ✓
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>You're registered!</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: '1.75rem', lineHeight: 1.7 }}>
              Show this QR code at the venue entrance. The organiser will scan it to mark your attendance and your OD slip will be generated automatically.
            </p>

            {/* QR image */}
            {attendanceQR ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <div style={{ padding: 16, borderRadius: 16, background: '#fff', boxShadow: '0 0 40px rgba(45,212,191,0.2)' }}>
                  <img src={attendanceQR} alt="Your attendance QR code" width={200} height={200} style={{ display: 'block' }} />
                </div>
              </div>
            ) : (
              <div style={{ height: 232, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 13, color: 'var(--t4)' }}>Generating QR...</div>
              </div>
            )}

            {/* Student info chip */}
            <div style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.18)', borderRadius: 10, padding: '10px 14px', marginBottom: '1.25rem', textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--teal-light)' }}>{savedForm.full_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>
                {savedForm.reg_number} · {savedForm.department} · {savedForm.year_sem}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-teal btn-full" style={{ height: 44 }} onClick={downloadQR} disabled={!attendanceQR}>
                ↓ Download QR as image
              </button>
              <button className="btn btn-ghost btn-full btn-sm" onClick={() => {
                if (!qrDataStr) return
                navigator.clipboard.writeText(qrDataStr)
                toast.success('QR data copied!')
              }}>
                Copy QR data (for manual check-in)
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 14, lineHeight: 1.6 }}>
              ⚠️ Screenshot or download this QR now — you'll need it at the event venue to get your OD.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
