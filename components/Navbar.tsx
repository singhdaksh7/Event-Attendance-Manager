'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function Navbar({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const dash = profile.role === 'hod' ? '/dashboard/hod' : profile.role === 'faculty' ? '/dashboard/faculty' : profile.role === 'admin' ? '/admin/accounts' : '/dashboard/student'
  const roleColor = profile.role === 'hod' ? '#fbbf24' : profile.role === 'faculty' ? '#34d399' : profile.role === 'admin' ? '#f87171' : '#a78bfa'

  async function signOut() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
  }

  const menuItems = [
    { label: 'Dashboard', href: dash },
    ...(profile.role !== 'admin' ? [{ label: 'Profile', href: '/profile' }] : []),
    ...(profile.role === 'admin' ? [
      { label: 'Accounts',  href: '/admin/accounts' },
    ] : []),
    ...(profile.role === 'faculty' || profile.role === 'hod' ? [
      { label: 'My Timetable', href: '/my-timetable' },
    ] : []),
    ...(profile.role === 'admin' ? [
      { label: 'Timetable',        href: '/admin/timetable' },
      { label: 'Import timetable', href: '/admin/timetable-import' },
      { label: 'Teachers',         href: '/admin/teachers' },
      { label: 'Notifications',    href: '/admin/notifications' },
    ] : []),
  ]

  return (
    <nav className="nav">
      <Link href={dash} className="nav-logo">Event<span>OD</span></Link>

      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {/* Quick links */}
        {(profile.role === 'faculty' || profile.role === 'hod') && (
          <Link href="/my-timetable">
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>My Timetable</button>
          </Link>
        )}
        {profile.role === 'admin' && (
          <Link href="/admin/timetable">
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>Timetable</button>
          </Link>
        )}
        {profile.role === 'admin' && (
          <Link href="/admin/accounts">
            <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>Accounts</button>
          </Link>
        )}

        {/* Avatar dropdown */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setOpen(o => !o)} style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg-3)', border:'1px solid var(--line-2)', cursor:'pointer', fontSize:12, fontWeight:600, color:roleColor, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {profile.full_name.charAt(0).toUpperCase()}
          </button>

          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }} />
              <div style={{ position:'absolute', right:0, top:40, zIndex:50, background:'var(--bg-2)', border:'1px solid var(--line-2)', borderRadius:'var(--r2)', minWidth:200, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--line)' }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{profile.full_name}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{profile.email}</div>
                  <div style={{ marginTop:6 }}>
                    <span className="badge badge-gray" style={{ fontSize:10, color:roleColor }}>{profile.role.toUpperCase()}</span>
                  </div>
                </div>
                {menuItems.map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="nav-menu-item">
                    {item.label}
                  </Link>
                ))}
                <div style={{ borderTop:'1px solid var(--line)' }}>
                  <div onClick={signOut} className="nav-menu-item nav-menu-item-danger">
                    Sign out
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
