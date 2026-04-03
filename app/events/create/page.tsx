'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

const EVENT_TYPES = [
  { value: 'technical',  label: 'Technical',  color: '#818cf8' },
  { value: 'hackathon',  label: 'Hackathon',  color: '#f472b6' },
  { value: 'cultural',   label: 'Cultural',   color: '#fbbf24' },
  { value: 'sports',     label: 'Sports',     color: '#4ade80' },
  { value: 'other',      label: 'Other',      color: 'var(--t3)' },
]

export default function CreateEventPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [faculties, setFaculties] = useState<Profile[]>([])
  const [hods, setHods] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', event_type: 'technical', venue: '', event_date: '', start_time: '', end_time: '', club_name: '', faculty_id: '', hod_id: '' })
  const router = useRouter()
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'student') { router.push('/dashboard/student'); return }
      setProfile(p)
      if (p.club_name) set('club_name', p.club_name)
      const { data: fac } = await supabase.from('profiles').select('*').eq('role', 'faculty')
      setFaculties(fac || [])
      const { data: h } = await supabase.from('profiles').select('*').eq('role', 'hod')
      setHods(h || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.venue || !form.event_date || !form.club_name || !form.faculty_id || !form.hod_id) {
      toast.error('Fill all required fields including faculty and HOD'); return
    }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
    const { error } = await supabase.from('events').insert({ ...form, organizer_id: user!.id, status: 'pending_approval' })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Event submitted for faculty approval!')
    router.push('/dashboard/student')
  }

  if (!profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ color: 'var(--t4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 680 }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <Link href="/dashboard/student" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>← Back to dashboard</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Create event</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Submit event details for faculty approval. Once approved, the event QR will be generated.</p>
        </div>

        <div className="card-accent" style={{ padding: '1.75rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Event type */}
            <div>
              <label className="lbl">Event type *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {EVENT_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set('event_type', t.value)}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', border: '1px solid', fontFamily: 'var(--font-body)', borderColor: form.event_type === t.value ? t.color : 'var(--border-dim)', background: form.event_type === t.value ? `rgba(${t.color === '#818cf8' ? '129,140,248' : t.color === '#f472b6' ? '244,114,182' : t.color === '#fbbf24' ? '251,191,36' : t.color === '#4ade80' ? '74,222,128' : '255,255,255'},0.1)` : 'var(--bg-surface)', color: form.event_type === t.value ? t.color : 'var(--t3)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="lbl">Event title *</label>
                <input className="inp" placeholder="e.g. TechFest 2025" value={form.title} onChange={e => set('title', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Club / Organisation *</label>
                <input className="inp" placeholder="e.g. IEEE SRM" value={form.club_name} onChange={e => set('club_name', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Venue *</label>
                <input className="inp" placeholder="e.g. Tech Park Auditorium" value={form.venue} onChange={e => set('venue', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Date *</label>
                <input className="inp" type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="lbl">Start time</label>
                  <input className="inp" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="lbl">End time</label>
                  <input className="inp" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="lbl">Description</label>
                <textarea className="inp" placeholder="Brief about the event, activities, requirements..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>

            <div className="divider" style={{ margin: '0.25rem 0' }} />

            {/* Faculty + HOD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="lbl">Faculty in-charge *</label>
                <select className="inp" value={form.faculty_id} onChange={e => set('faculty_id', e.target.value)} required>
                  <option value="">Select faculty</option>
                  {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name} · {f.department}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">HOD *</label>
                <select className="inp" value={form.hod_id} onChange={e => set('hod_id', e.target.value)} required>
                  <option value="">Select HOD</option>
                  {hods.map(h => <option key={h.id} value={h.id}>{h.full_name} · {h.department}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit for approval →'}
              </button>
              <Link href="/dashboard/student"><button type="button" className="btn btn-ghost">Cancel</button></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
