'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { generateQRCode, generateEventQRData } from '@/lib/qr'
import type { Profile, Event } from '@/lib/types'

export default function EventQRPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [qrImage, setQrImage] = useState('')   // base64 PNG — generated client-side
  const [regLink, setRegLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [regCount, setRegCount] = useState(0)
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)

      const { data: ev, error } = await supabase
        .from('events').select('*, faculty:faculty_id(full_name)')
        .eq('id', eventId).single()

      if (error || !ev) { toast.error('Event not found'); router.push('/dashboard/student'); return }
      if (ev.status !== 'approved') { toast.error('Event not yet approved'); router.push('/dashboard/student'); return }
      setEvent(ev)

      const { count } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
      setRegCount(count || 0)

      // Build the registration URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const link = generateEventQRData(eventId, appUrl)  // = `${appUrl}/register/${eventId}`
      setRegLink(link)

      // Generate QR image client-side from the URL
      const qrImg = await generateQRCode(link)
      setQrImage(qrImg)
      setLoading(false)
    }
    load()
  }, [eventId])

  function downloadQR() {
    if (!qrImage) return
    const a = document.createElement('a')
    a.href = qrImage
    a.download = `event-qr-${event?.title?.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
    toast.success('QR downloaded!')
  }

  if (loading || !profile) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t4)' }}>Generating QR...</div>
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 520 }}>
        <Link href="/dashboard/student" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>← Back</Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, flex: 1 }}>Event QR Code</h1>
          <span className="badge badge-teal">Approved</span>
        </div>

        {/* Event info */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{event?.title}</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            {event?.club_name} · {event?.event_date} · {event?.venue}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="badge badge-indigo">{regCount} registered</span>
          </div>
        </div>

        {/* QR display */}
        <div className="card-indigo" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: '1.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            Share this with students to register
          </p>
          {qrImage ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{ padding: 16, borderRadius: 16, background: '#fff', boxShadow: '0 0 40px rgba(99,102,241,0.25)' }}>
                <img src={qrImage} alt="Event registration QR" width={220} height={220} style={{ display: 'block' }} />
              </div>
            </div>
          ) : (
            <div style={{ height: 252, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--t4)' }}>Generating...</div>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--t4)' }}>Students scan with phone camera → registration page opens automatically</p>
        </div>

        {/* Registration link */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 11, color: 'var(--t4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Direct registration link
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--indigo-light)', wordBreak: 'break-all', lineHeight: 1.5 }}>
            {regLink}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-primary" onClick={downloadQR} disabled={!qrImage}>
            ↓ Download QR
          </button>
          <button className="btn btn-ghost" onClick={() => {
            navigator.clipboard.writeText(regLink)
            toast.success('Registration link copied!')
          }}>
            Copy link
          </button>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Link href={`/events/${eventId}/scanner`}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
              Open attendance scanner →
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
