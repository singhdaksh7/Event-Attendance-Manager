export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <header style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.04em' }}>
          Event<span style={{ color: '#8b5cf6' }}>OD</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/auth/login"><button className="btn btn-ghost btn-sm">Sign in</button></Link>
          <Link href="/auth/signup"><button className="btn btn-primary btn-sm">Get started</button></Link>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
        <div className="fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 32, letterSpacing: '0.04em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            SRM INSTITUTE OF SCIENCE AND TECHNOLOGY
          </div>

          <h1 style={{ fontSize: 'clamp(36px,6vw,64px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 20 }}>
            Event registration &<br />OD management
          </h1>

          <p style={{ fontSize: 16, color: '#71717a', maxWidth: 420, margin: '0 auto 40px', lineHeight: 1.7 }}>
            From event creation to approved OD slip — the entire workflow in one place for SRM students, faculty, and HODs.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/signup"><button className="btn btn-primary btn-lg">Get started →</button></Link>
            <Link href="/auth/login"><button className="btn btn-ghost btn-lg">Sign in</button></Link>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 1, marginTop: 80, maxWidth: 800, width: '100%', background: 'rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { n: '01', t: 'Create event',     d: 'Club head submits with faculty & HOD assigned' },
            { n: '02', t: 'Faculty approves', d: 'Event QR is generated after approval' },
            { n: '03', t: 'Students scan',    d: 'Scan QR → register → get attendance QR' },
            { n: '04', t: 'Mark attendance',  d: 'Organiser scans at venue, OD auto-created' },
            { n: '05', t: 'OD approved',      d: 'Faculty → HOD two-step approval' },
            { n: '06', t: 'Download slip',    d: 'Printable OD certificate with signatures' },
          ].map(s => (
            <div key={s.n} style={{ padding: '20px', background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#52525b', letterSpacing: '0.08em', marginBottom: 8 }}>{s.n}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.t}</div>
              <div style={{ fontSize: 11, color: '#52525b', lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', fontSize: 11, color: '#3f3f46' }}>
        EventOD · SRM Institute of Science and Technology
      </footer>
    </div>
  )
}
