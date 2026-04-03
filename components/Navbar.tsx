'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function Navbar({ profile }: { profile: Profile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
  }

  const roleConfig = {
    student: { label: 'Student', bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', border: 'rgba(99,102,241,0.25)' },
    faculty: { label: 'Faculty', bg: 'rgba(45,212,191,0.1)',  color: '#2dd4bf', border: 'rgba(45,212,191,0.25)' },
    hod:     { label: 'HOD',     bg: 'rgba(245,158,11,0.1)',  color: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  }
  const rc = roleConfig[profile.role]
  const dashPath = profile.role === 'student' ? '/dashboard/student' : profile.role === 'hod' ? '/dashboard/hod' : '/dashboard/faculty'

  return (
    <nav className="navbar">
      <Link href={dashPath} className="navbar-brand">EventOD</Link>

      <div className="navbar-right">
        {/* Desktop info */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', lineHeight: 1 }}>{profile.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{profile.department}</div>
        </div>

        {/* Avatar + dropdown */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(m => !m)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: rc.bg, border: `1px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: rc.color, flexShrink: 0 }}>
            {profile.full_name.charAt(0).toUpperCase()}
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: 44, zIndex: 50, background: 'var(--bg-overlay)', border: '1px solid var(--border-soft)', borderRadius: 12, minWidth: 180, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-dim)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{profile.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>{profile.email}</div>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>{rc.label}</span>
                </div>
                <Link href={dashPath} onClick={() => setMenuOpen(false)}>
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    🏠 Dashboard
                  </div>
                </Link>
                <Link href="/profile" onClick={() => setMenuOpen(false)}>
                  <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    👤 My profile
                  </div>
                </Link>
                <div style={{ borderTop: '1px solid var(--border-dim)' }}>
                  <div onClick={signOut} style={{ padding: '10px 14px', fontSize: 13, color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    ↩ Sign out
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
