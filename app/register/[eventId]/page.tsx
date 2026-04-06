'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { generateQRCode, generateAttendanceQRData } from '@/lib/qr'
import type { Event } from '@/lib/types'

interface Section {
  id: string
  department: string
  specialisation: string
  year_label: string
  section_code: string
  display_name: string
}

interface Department {
  id: string
  name: string
  specialisations: string[]
}

export default function RegisterPage() {
  const [event,       setEvent]       = useState<Event | null>(null)
  const [sections,    setSections]    = useState<Section[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [step,        setStep]        = useState<'form'|'done'>('form')
  const [qrImage,     setQrImage]     = useState('')
  const [qrDataStr,   setQrDataStr]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [savedInfo,   setSavedInfo]   = useState({ name:'', reg:'', dept:'', year:'', section:'' })

  const [form, setForm] = useState({
    full_name:      '',
    reg_number:     '',
    department:     '',
    specialisation: '',
    year_sem:       '',
    section:        '',
    phone:          '',
    email:          '',
    role_in_event:  'Participant',
  })

  const params   = useParams()
  const supabase = createClient()
  const eventId  = params.eventId as string
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Derived dropdown options based on current selections
  const deptOptions  = departments.map(d => d.name)
  const specOptions  = departments.find(d => d.name === form.department)?.specialisations || []
  const yearOptions  = ['1st Year', '2nd Year', '3rd Year', '4th Year']
  const sectionOptions = sections
    .filter(s =>
      s.department     === form.department &&
      s.specialisation === form.specialisation &&
      s.year_label     === form.year_sem
    )
    .map(s => s.section_code)

  // Reset downstream when parent changes
  function setDept(v: string) {
    setForm(f => ({ ...f, department: v, specialisation: '', year_sem: '', section: '' }))
  }
  function setSpec(v: string) {
    setForm(f => ({ ...f, specialisation: v, year_sem: '', section: '' }))
  }
  function setYear(v: string) {
    setForm(f => ({ ...f, year_sem: v, section: '' }))
  }

  useEffect(() => {
    async function load() {
      // Load event
      const { data: ev } = await supabase
        .from('events').select('*')
        .eq('id', eventId).eq('status', 'approved').single()
      if (!ev) { setPageLoading(false); return }
      setEvent(ev)

      // Load departments
      const { data: depts } = await supabase
        .from('departments').select('*').order('name')
      setDepartments(depts || [])

      // Load all sections
      const { data: secs } = await supabase
        .from('sections').select('*').order('department').order('year_label').order('section_code')
      setSections(secs || [])

      // Pre-fill if logged in
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (p) setForm(f => ({ ...f, full_name: p.full_name || '', email: p.email || '', reg_number: p.reg_number || '', phone: p.phone || '' }))
      }
      setPageLoading(false)
    }
    load()
  }, [eventId])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.reg_number || !form.department || !form.year_sem || !form.section) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)

    try {
      const { data: existing } = await supabase
        .from('event_registrations').select('id, attendance_qr_data')
        .eq('event_id', eventId).eq('reg_number', form.reg_number).maybeSingle()

      if (existing) {
        toast('Already registered!', { icon: 'ℹ️' })
        const qd  = existing.attendance_qr_data || generateAttendanceQRData(existing.id, form.reg_number)
        const img = await generateQRCode(qd)
        setQrImage(img); setQrDataStr(qd)
        setSavedInfo({ name: form.full_name, reg: form.reg_number, dept: form.department, year: form.year_sem, section: form.section })
        setStep('done'); setLoading(false); return
      }

      const { data: { session } } = await supabase.auth.getSession()

      // year_sem stored as e.g. "2nd Year / Sem 3" — we store year_label + section separately
      // section field = section_code, year_sem = year_label for timetable matching
      const { data: reg, error } = await supabase
        .from('event_registrations')
        .insert({
          event_id:       eventId,
          student_id:     session?.user?.id || null,
          full_name:      form.full_name,
          reg_number:     form.reg_number,
          department:     `${form.department} ${form.specialisation}`.trim(),
          year_sem:       form.year_sem,
          section:        form.section,
          phone:          form.phone   || null,
          email:          form.email   || null,
          role_in_event:  form.role_in_event,
        })
        .select('id').single()

      if (error || !reg) { toast.error(error?.message || 'Registration failed'); setLoading(false); return }

      const qd  = generateAttendanceQRData(reg.id, form.reg_number)
      await supabase.from('event_registrations').update({ attendance_qr_data: qd }).eq('id', reg.id)

      const img = await generateQRCode(qd)
      setQrImage(img); setQrDataStr(qd)
      setSavedInfo({ name: form.full_name, reg: form.reg_number, dept: form.department, year: form.year_sem, section: form.section })
      setStep('done')
      toast.success('Registered!')
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
    setLoading(false)
  }

  if (pageLoading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:20, height:20, border:'2px solid var(--bg-3)', borderTopColor:'#8b5cf6', borderRadius:'50%', animation:'spinning 0.6s linear infinite' }} />
      <style>{`@keyframes spinning{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!event) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card card-p" style={{ maxWidth:360, textAlign:'center' }}>
        <div style={{ fontSize:13, color:'var(--t3)' }}>This event is not open for registration.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'40px 20px' }}>
      <div style={{ maxWidth:440, margin:'0 auto' }}>

        {/* Event info */}
        <div className="card card-p" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontWeight:600, fontSize:15 }}>{event.title}</span>
            <span className={`badge type-${event.event_type}`}>{event.event_type}</span>
          </div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>
            {event.club_name} · {event.event_date}
            {event.start_time && ` · ${event.start_time}${event.end_time ? ' – ' + event.end_time : ''}`}
          </div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>📍 {event.venue}</div>
        </div>

        {step === 'form' ? (
          <div className="card card-p">
            <h2 style={{ marginBottom:4 }}>Register</h2>
            <p style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>
              Fill your details to get your attendance QR code.
            </p>

            <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Name & Reg */}
              <div>
                <label className="lbl">Full name *</label>
                <input className="inp" placeholder="Your full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Register number *</label>
                <input className="inp" placeholder="RA2111003010234" value={form.reg_number}
                  onChange={e => set('reg_number', e.target.value.toUpperCase())} required
                  style={{ fontFamily:'monospace', letterSpacing:'0.04em' }} />
              </div>

              <hr />
              <div style={{ fontSize:11, color:'var(--t3)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>Class details</div>

              {/* Department */}
              <div>
                <label className="lbl">Department *</label>
                {deptOptions.length > 0 ? (
                  <select className="inp" value={form.department} onChange={e => setDept(e.target.value)} required>
                    <option value="">Select department</option>
                    {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <input className="inp" placeholder="e.g. CSE" value={form.department} onChange={e => setDept(e.target.value)} required />
                )}
              </div>

              {/* Specialisation — only show if dept selected and has specialisations */}
              {form.department && specOptions.length > 0 && (
                <div>
                  <label className="lbl">Specialisation *</label>
                  <select className="inp" value={form.specialisation} onChange={e => setSpec(e.target.value)} required>
                    <option value="">Select specialisation</option>
                    {specOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Year */}
              {(form.department) && (
                <div>
                  <label className="lbl">Year *</label>
                  <select className="inp" value={form.year_sem} onChange={e => setYear(e.target.value)} required>
                    <option value="">Select year</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {/* Section */}
              {form.year_sem && (
                <div>
                  <label className="lbl">Section *</label>
                  {sectionOptions.length > 0 ? (
                    <select className="inp" value={form.section} onChange={e => set('section', e.target.value)} required>
                      <option value="">Select section</option>
                      {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{ padding:'10px 12px', background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:'var(--r)', fontSize:13, color:'var(--t3)' }}>
                      No sections found for this combination. Contact the organiser.
                    </div>
                  )}
                </div>
              )}

              <hr />

              {/* Contact */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
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

              <button className="btn btn-primary btn-full btn-lg" style={{ marginTop:4 }} type="submit"
                disabled={loading || (!!form.year_sem && sectionOptions.length === 0)}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <span className="spin" />Registering...
                    </span>
                  : 'Register & get QR →'}
              </button>
            </form>
          </div>

        ) : (
          <div className="card card-p fade-up" style={{ textAlign:'center' }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:20 }}>✓</div>
            <h2 style={{ marginBottom:6 }}>You're registered</h2>
            <p style={{ fontSize:13, color:'var(--t3)', marginBottom:24, lineHeight:1.6 }}>
              Show this QR at the venue. The organiser scans it to mark attendance and trigger your OD.
            </p>

            {qrImage && (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
                <div style={{ padding:12, borderRadius:12, background:'#fff' }}>
                  <img src={qrImage} alt="Attendance QR" width={180} height={180} style={{ display:'block' }} />
                </div>
              </div>
            )}

            <div style={{ background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:16, textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{savedInfo.name}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, fontFamily:'monospace' }}>{savedInfo.reg}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                {savedInfo.dept} · {savedInfo.year} · Section {savedInfo.section}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button className="btn btn-primary btn-full" disabled={!qrImage}
                onClick={() => { const a = document.createElement('a'); a.href = qrImage; a.download = `qr-${savedInfo.reg}.png`; a.click() }}>
                ↓ Download QR
              </button>
              <button className="btn btn-ghost btn-full btn-sm"
                onClick={() => { navigator.clipboard.writeText(qrDataStr); toast.success('Copied!') }}>
                Copy QR data
              </button>
            </div>
            <p style={{ fontSize:11, color:'var(--t4)', marginTop:14, lineHeight:1.6 }}>
              Screenshot or download — you'll need this at the venue.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
