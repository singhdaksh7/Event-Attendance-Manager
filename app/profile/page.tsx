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
  const [form, setForm] = useState({ full_name: '', phone: '', reg_number: '', department: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)
      setForm({ full_name: p.full_name || '', phone: p.phone || '', reg_number: p.reg_number || '', department: p.department || '' })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', profile!.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    setProfile(p => p ? { ...p, ...form } : p)
    toast.success('Profile updated!')
    setSaving(false)
  }

  const dashPath = profile?.role === 'student' ? '/dashboard/student' : profile?.role === 'hod' ? '/dashboard/hod' : '/dashboard/faculty'
  const roleConfig = { student: { label: 'Student', color: '#818cf8' }, faculty: { label: 'Faculty', color: '#2dd4bf' }, hod: { label: 'HOD', color: '#fbbf24' } }
  const rc = roleConfig[profile?.role || 'student']

  if (loading || !profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ color: 'var(--t4)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading...</div>
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 560 }}>
        <Link href={dashPath} style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>← Dashboard</Link>

        {/* Avatar + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-overlay)', border: '2px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: rc.color }}>
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{profile.full_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `rgba(${rc.color === '#818cf8' ? '129,140,248' : rc.color === '#2dd4bf' ? '45,212,191' : '245,158,11'},0.1)`, color: rc.color, border: `1px solid ${rc.color}30` }}>{rc.label}</span>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{profile.email}</span>
            </div>
          </div>
        </div>

        <div className="card-accent" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: '1.25rem' }}>Edit profile</h2>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="lbl">Full name</label>
              <input className="inp" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="lbl">Department</label>
                <input className="inp" value={form.department} onChange={e => set('department', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Phone</label>
                <input className="inp" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
            {profile.role === 'student' && (
              <div>
                <label className="lbl">Register number</label>
                <input className="inp" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} value={form.reg_number} onChange={e => set('reg_number', e.target.value.toUpperCase())} />
              </div>
            )}
            <div className="divider" />
            <div>
              <label className="lbl">Email address</label>
              <input className="inp" value={profile.email} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 5 }}>Email cannot be changed. Contact admin if needed.</p>
            </div>
            <div>
              <label className="lbl">Role</label>
              <input className="inp" value={rc.label} disabled style={{ opacity: 0.5, cursor: 'not-allowed', color: rc.color }} />
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 4 }} type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
