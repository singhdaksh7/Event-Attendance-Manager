export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.08) 0%, #04040a 60%)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 96, fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(45,212,191,0.2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '1rem' }}>404</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f0f0ff', marginBottom: 10 }}>Page not found</h1>
        <p style={{ fontSize: 14, color: '#606080', marginBottom: '2rem', lineHeight: 1.6 }}>This page doesn't exist or you don't have access to it.</p>
        <Link href="/">
          <button style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>← Go home</button>
        </Link>
      </div>
    </div>
  )
}
