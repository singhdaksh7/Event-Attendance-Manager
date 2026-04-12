'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 55%)' }}>
      <header className="nav">
        <Link href="/" className="nav-logo">Event<span>OD</span></Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="fade-up" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>Create account</h1>
            <p style={{ fontSize: 13, color: 'var(--t3)' }}>SRM Institute · EventOD</p>
          </div>

          {/* Student-only notice */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 'var(--r)', marginBottom: 20 }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🎓</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', marginBottom: 2 }}>Student registration</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                Faculty and HOD accounts are created by the administrator. Contact your admin if you need access.
              </div>
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
