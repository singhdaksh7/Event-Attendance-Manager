'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form,    setForm]    = useState({ full_name:'', phone:'', reg_number:'', department:'' })
  const [saving,  setSaving]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!p) return
      setProfile(p)
      setForm({ full_name:p.full_name||'', phone:p.phone||'', reg_number:p.reg_number||'', department:p.department||'' })
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', profile!.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    setProfile(p => p ? { ...p, ...form } : p)
    toast.success('Profile saved'); setSaving(false)
  }

  const dash = profile?.role === 'hod' ? '/dashboard/hod' : profile?.role === 'faculty' ? '/dashboard/faculty' : '/dashboard/student'

  if (!profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ maxWidth:520, paddingTop:32, paddingBottom:60 }}>
        <Link href={dash} style={{ fontSize:12, color:'var(--t3)', textDecoration:'none', display:'inline-block', marginBottom:20 }}>← Dashboard</Link>
        <h1 style={{ marginBottom:4 }}>Profile</h1>
        <p style={{ fontSize:13, color:'var(--t3)', marginBottom:24 }}>{profile.email} · <span style={{ textTransform:'capitalize' }}>{profile.role}</span></p>

        <div className="card card-p">
          <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><label className="lbl">Full name</label><input className="inp" value={form.full_name} onChange={e => set('full_name', e.target.value)} required /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="lbl">Department</label><input className="inp" value={form.department} onChange={e => set('department', e.target.value)} /></div>
              <div><label className="lbl">Phone</label><input className="inp" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            </div>
            {profile.role === 'student' && (
              <div><label className="lbl">Register number</label><input className="inp" value={form.reg_number} onChange={e => set('reg_number', e.target.value.toUpperCase())} style={{ fontFamily:'monospace', letterSpacing:'0.04em' }} /></div>
            )}
            <hr />
            <div><label className="lbl">Email (cannot change)</label><input className="inp" value={profile.email} disabled /></div>
            <div><label className="lbl">Role (cannot change)</label><input className="inp" value={profile.role} disabled style={{ textTransform:'capitalize' }} /></div>
            <button className="btn btn-primary btn-full" style={{ marginTop:4 }} type="submit" disabled={saving}>
              {saving ? <><span className="spin"/>Saving...</> : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
