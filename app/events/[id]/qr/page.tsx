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
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [event,     setEvent]     = useState<Event | null>(null)
  const [qrImage,   setQrImage]   = useState('')
  const [regLink,   setRegLink]   = useState('')
  const [regCount,  setRegCount]  = useState(0)
  const [loading,   setLoading]   = useState(true)
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const eventId  = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)
      const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).single()
      if (!ev || ev.status !== 'approved') { toast.error('Event not approved yet'); router.push('/dashboard/student'); return }
      setEvent(ev)
      const { count } = await supabase.from('event_registrations').select('*', { count:'exact', head:true }).eq('event_id', eventId)
      setRegCount(count || 0)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const link   = generateEventQRData(eventId, appUrl)
      setRegLink(link)
      setQrImage(await generateQRCode(link))
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading || !profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ maxWidth:480, paddingTop:32, paddingBottom:60 }}>
        <Link href="/dashboard/student" style={{ fontSize:12, color:'var(--t3)', textDecoration:'none', display:'inline-block', marginBottom:20 }}>← Back</Link>
        <h1 style={{ marginBottom:4 }}>Event QR</h1>
        <p style={{ fontSize:13, color:'var(--t3)', marginBottom:24 }}>{event?.title} · {regCount} registered</p>

        <div className="card card-p" style={{ textAlign:'center', marginBottom:16 }}>
          {qrImage ? (
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
              <div style={{ padding:12, borderRadius:12, background:'#fff' }}>
                <img src={qrImage} alt="Event QR" width={220} height={220} style={{ display:'block' }} />
              </div>
            </div>
          ) : (
            <div style={{ height:244, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:20, height:20, border:'2px solid var(--bg-3)', borderTopColor:'var(--accent-2)', borderRadius:'50%', animation:'spinning 0.6s linear infinite' }} />
            </div>
          )}
          <p style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>Students scan with phone camera to register</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button className="btn btn-primary" disabled={!qrImage} onClick={() => { const a=document.createElement('a'); a.href=qrImage; a.download=`event-qr.png`; a.click(); toast.success('Downloaded!') }}>↓ Download QR</button>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(regLink); toast.success('Link copied!') }}>Copy link</button>
          </div>
        </div>

        <div className="card card-p">
          <div style={{ fontSize:11, color:'var(--t3)', fontWeight:500, marginBottom:6, letterSpacing:'0.03em', textTransform:'uppercase' }}>Registration link</div>
          <div style={{ fontSize:12, fontFamily:'monospace', color:'var(--accent-2)', wordBreak:'break-all', lineHeight:1.5 }}>{regLink}</div>
        </div>

        <div style={{ marginTop:12, textAlign:'center' }}>
          <Link href={`/events/${eventId}/scanner`}><button className="btn btn-ghost btn-sm">Open scanner →</button></Link>
        </div>
      </div>
      <style>{`@keyframes spinning{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
