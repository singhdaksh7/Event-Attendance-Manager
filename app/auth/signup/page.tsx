'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

const ROLES = [
  { value: 'student', label: 'Student',  desc: 'Register for events & get OD', color: '#818cf8', rgb: '99,102,241' },
  { value: 'faculty', label: 'Faculty',  desc: 'Approve events & OD requests',  color: '#2dd4bf', rgb: '45,212,191' },
  { value: 'hod',     label: 'HOD',      desc: 'Final OD approval authority',   color: '#fbbf24', rgb: '245,158,11' },
]

export default function SignupPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    role: 'student' as Role,
    department: '', reg_number: '', phone: ''
  })
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.department.trim()) {
      toast.error('Please fill all required fields')
      return
    }
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name:   form.full_name.trim(),
          role:        form.role,
          department:  form.department.trim(),
          reg_number:  form.reg_number.trim() || null,
          phone:       form.phone.trim()       || null,
        }
      }
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Account created! Please check your email to verify, then sign in.')
    setTimeout(() => { window.location.href = '/auth/login' }, 1800)
  }

  return (
    <div className="page-bg min-h-screen flex items-center justify-center px-4 py-8">
      <div style={{ position: 'fixed', top: '20%', right: '5%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="fade-up" style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.04em', textDecoration: 'none' }}>
            EventOD
          </Link>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 6 }}>Create your account</p>
        </div>

        <div className="card-accent" style={{ padding: '2rem' }}>
          {/* Role picker */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="lbl" style={{ marginBottom: 8 }}>I am a</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => set('role', r.value)}
                  style={{
                    padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${form.role === r.value ? r.color : 'var(--border-dim)'}`,
                    background: form.role === r.value ? `rgba(${r.rgb},0.1)` : 'var(--bg-surface)',
                    transition: 'all 0.15s', textAlign: 'center', fontFamily: 'var(--font-body)',
                  }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: form.role === r.value ? r.color : 'var(--t2)', marginBottom: 3 }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)', lineHeight: 1.3 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="lbl">Department *</label>
                <input className="inp" placeholder="CSE / ECE / MBA" value={form.department} onChange={e => set('department', e.target.value)} required />
              </div>
              <div>
                <label className="lbl">Phone</label>
                <input className="inp" type="tel" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
            {form.role === 'student' && (
              <div>
                <label className="lbl">Register number</label>
                <input className="inp"
                  placeholder="RA2111003010234"
                  value={form.reg_number}
                  onChange={e => set('reg_number', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                />
              </div>
            )}
            <button
              className="btn btn-teal btn-full"
              style={{ marginTop: 6, height: 46 }}
              type="submit"
              disabled={loading}
            >
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#04040a', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Creating account...
                  </span>
                : 'Create account →'
              }
            </button>
          </form>

          <div className="divider" />
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--indigo-light)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--t4)', marginTop: 14, lineHeight: 1.6 }}>
          After signing up, check your email for a verification link before signing in.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
