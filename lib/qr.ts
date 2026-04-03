import QRCode from 'qrcode'

export async function generateQRCode(data: string): Promise<string> {
  try {
    const qr = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
      width: 300,
    })
    return qr
  } catch (err) {
    console.error('QR generation error:', err)
    throw err
  }
}

export function generateEventQRData(eventId: string, appUrl: string): string {
  return `${appUrl}/register/${eventId}`
}

// Store only the compact JSON string — NOT the base64 image
// The base64 image is generated client-side from this string on demand
export function generateAttendanceQRData(registrationId: string, regNumber: string): string {
  return JSON.stringify({ type: 'attendance', registrationId, regNumber })
}

export function generateSlipId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'OD-'
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}
