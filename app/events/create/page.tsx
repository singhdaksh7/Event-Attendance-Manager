'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

const TYPES = ['technical','hackathon','cultural','sports','other']

export default function CreateEventPage() {
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [faculties, setFaculties] = useState<Profile[]>([])
  const [hods,      setHods]      = useState<Profile[]>([])
  const [loading,   setLoading]   = useState(false)
  const [form, setForm] = useState({ title:'', description:'', event_type:'technical', venue:'', event_date:'', start_time:'', end_time:'', club_name:'', faculty_id:'', hod_id:'' })
  const router   = useRouter()
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
      const { data: fac } = await supabase.from('profiles').select('*').eq('role', 'faculty')
      setFaculties(fac || [])
      const { data: h } = await supabase.from('profiles').select('*').eq('role', 'hod')
      setHods(h || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.faculty_id || !form.hod_id) { toast.error('Select faculty and HOD'); return }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('events').insert({ ...form, organizer_id: session!.user.id, status: 'pending_approval' })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Event submitted for approval')
    router.push('/dashboard/student')
  }

  if (!profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ maxWidth: 640, paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/student" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none' }}>← Back</Link>
          <h1 style={{ marginTop: 10 }}>Create event</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Submit for faculty approval. Once approved, event QR is generated.</p>
        </div>

        <div className="card card-p">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Type pills */}
            <div>
              <label className="lbl">Event type</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TYPES.map(t => (
                  <button key={t} type="button" onClick={() => set('event_type', t)}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${form.event_type === t ? 'var(--accent-2)' : 'var(--line-2)'}`, background: form.event_type === t ? 'rgba(124,58,237,0.12)' : 'transparent', color: form.event_type === t ? '#a78bfa' : 'var(--t3)', transition: 'all 0.1s' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                <input className="inp" placeholder="e.g. Main Auditorium" value={form.venue} onChange={e => set('venue', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Date *</label>
                <input className="inp" type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="lbl">Start</label>
                  <input className="inp" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="lbl">End</label>
                  <input className="inp" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
                </div>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="lbl">Description</label>
                <textarea className="inp" placeholder="Brief about the event..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
            </div>

            <hr />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} type="submit" disabled={loading}>
                {loading ? <><span className="spin" />Submitting...</> : 'Submit for approval →'}
              </button>
              <Link href="/dashboard/student"><button type="button" className="btn btn-ghost btn-lg">Cancel</button></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
