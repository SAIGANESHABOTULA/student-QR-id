import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrImage({ value, size = 220, className, dark = '#0f172a' }: {
  value: string; size?: number; className?: string; dark?: string
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size * 2, color: { dark, light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''))
    return () => { alive = false }
  }, [value, size, dark])
  if (!src) return <div className={className} style={{ width: size, height: size }} />
  return <img src={src} width={size} height={size} alt="Signed credential QR code" className={className} />
}
