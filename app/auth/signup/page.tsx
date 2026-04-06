'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'student', label: 'Student',  desc: 'Register & get OD' },
  { value: 'faculty', label: 'Faculty',  desc: 'Approve events & OD' },
  { value: 'hod',     label: 'HOD',      desc: 'Final OD authority' },
]

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'student' as Role, department: '', reg_number: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.department.trim()) { toast.error('Fill all required fields'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name.trim(), role: form.role, department: form.department.trim(), reg_number: form.reg_number.trim() || null, phone: form.phone.trim() || null } }
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Account created! Check email to verify.')
    setTimeout(() => { window.location.href = '/auth/login' }, 1500)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 52, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <Link href="/" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.04em', textDecoration: 'none', color: 'var(--t1)' }}>
          Event<span style={{ color: '#8b5cf6' }}>OD</span>
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="fade-up" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>Create account</h1>
            <p style={{ fontSize: 13, color: 'var(--t3)' }}>SRM Institute · EventOD</p>
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 20 }}>
            <label className="lbl">I am a</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  style={{ padding: '10px 8px', borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', transition: 'all 0.12s', border: `1px solid ${form.role === r.value ? 'var(--accent-2)' : 'var(--line-2)'}`, background: form.role === r.value ? 'rgba(124,58,237,0.12)' : 'var(--bg-1)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: form.role === r.value ? '#a78bfa' : 'var(--t2)' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2, lineHeight: 1.3 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="lbl">Full name *</label>
              <input className="inp" placeholder="Daksh Singh" value={form.full_name} onChange={e => set('full_name', e.target.value)} required autoComplete="name" />
            </div>
            <div>
              <label className="lbl">Email *</label>
              <input className="inp" type="email" placeholder="you@srmist.edu.in" value={form.email} onChange={e => set('email', e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="lbl">Password *</label>
              <input className="inp" type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => set('password', e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="lbl">Department *</label>
                <input className="inp" placeholder="CSE" value={form.department} onChange={e => set('department', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Phone</label>
                <input className="inp" type="tel" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
            {form.role === 'student' && (
              <div>
                <label className="lbl">Register number</label>
                <input className="inp" placeholder="RA2111003010234" value={form.reg_number} onChange={e => set('reg_number', e.target.value.toUpperCase())} style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }} />
              </div>
            )}
            <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }} type="submit" disabled={loading}>
              {loading ? <><span className="spin" />Creating...</> : 'Create account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)', marginTop: 20 }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--accent-2)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
