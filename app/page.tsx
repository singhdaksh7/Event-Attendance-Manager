export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="page-bg min-h-screen flex flex-col">
      {/* top nav */}
      <header style={{ padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>
          EventOD
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/auth/login"><button className="btn btn-ghost btn-sm">Sign in</button></Link>
          <Link href="/auth/signup"><button className="btn btn-primary btn-sm">Get started</button></Link>
        </div>
      </header>

      {/* hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1.5rem', textAlign: 'center' }}>
        {/* pill */}
        <div className="fade-up" style={{ marginBottom: '1.75rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', letterSpacing: '0.05em' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', display: 'inline-block', boxShadow: '0 0 8px #2dd4bf' }}></span>
            SRM INSTITUTE OF SCIENCE AND TECHNOLOGY
          </span>
        </div>

        <h1 className="fade-up" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(42px, 8vw, 80px)', fontWeight: 800, lineHeight: 1.0, letterSpacing: '-0.04em', marginBottom: '1.5rem', animationDelay: '60ms' }}>
          <span style={{ color: 'var(--t1)' }}>Event</span>
          <span style={{ background: 'linear-gradient(135deg, #818cf8 30%, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>OD</span>
        </h1>

        <p className="fade-up" style={{ fontSize: 18, color: 'var(--t2)', maxWidth: 480, lineHeight: 1.7, marginBottom: '0.75rem', animationDelay: '120ms' }}>
          End-to-end On Duty management — from event creation to approved OD slip, fully automated.
        </p>
        <p className="fade-up" style={{ fontSize: 14, color: 'var(--t4)', marginBottom: '2.5rem', animationDelay: '160ms' }}>
          For club heads · students · faculty · HOD
        </p>

        <div className="fade-up" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '200ms' }}>
          <Link href="/auth/signup">
            <button className="btn btn-primary btn-lg glow-pulse">
              Create account →
            </button>
          </Link>
          <Link href="/auth/login">
            <button className="btn btn-ghost btn-lg">Sign in</button>
          </Link>
        </div>

        {/* flow steps */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: '5rem', maxWidth: 860, width: '100%' }}>
          {[
            { step: '01', icon: '✦', title: 'Club head creates event', desc: 'Fill details, assign faculty & HOD, submit for approval', color: '#818cf8' },
            { step: '02', icon: '◈', title: 'Faculty approves', desc: 'Faculty reviews and approves — event QR is generated instantly', color: '#2dd4bf' },
            { step: '03', icon: '⬡', title: 'Students scan & register', desc: 'Scan QR → fill form → receive personal attendance QR', color: '#f472b6' },
            { step: '04', icon: '◉', title: 'Attendance at venue', desc: 'Club head scans QRs → OD requests auto-created', color: '#fbbf24' },
            { step: '05', icon: '❋', title: 'OD approved', desc: 'Faculty → HOD approval chain, fully in-app', color: '#4ade80' },
            { step: '06', icon: '▣', title: 'Download OD slip', desc: 'Printable SRM-format certificate with all signatures', color: '#818cf8' },
          ].map(s => (
            <div key={s.step} className="card fade-up" style={{ padding: '1.25rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: s.color, fontWeight: 600, letterSpacing: '0.1em' }}>{s.step}</span>
                <span style={{ fontSize: 16, color: s.color }}>{s.icon}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 5, color: 'var(--t1)' }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '1.5rem', textAlign: 'center', borderTop: '1px solid rgba(99,102,241,0.08)', fontSize: 12, color: 'var(--t4)' }}>
        EventOD · SRM Institute of Science and Technology · Built with Next.js + Supabase
      </footer>
    </div>
  )
}
