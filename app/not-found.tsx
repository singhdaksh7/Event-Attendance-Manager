export const dynamic = 'force-dynamic'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ fontSize:72, fontWeight:700, color:'#222', letterSpacing:'-0.05em', lineHeight:1, marginBottom:16 }}>404</div>
      <div style={{ fontSize:16, fontWeight:500, marginBottom:8 }}>Page not found</div>
      <div style={{ fontSize:13, color:'#52525b', marginBottom:28 }}>This page doesn't exist or you don't have access.</div>
      <Link href="/"><button style={{ height:36, padding:'0 16px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>← Home</button></Link>
    </div>
  )
}
