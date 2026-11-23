import clsx from 'clsx'
import { Camera, CameraOff, FlashlightOff, Flashlight, ImageUp, SwitchCamera } from 'lucide-react'
import QrScanner from 'qr-scanner'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

/** Camera QR scanner with image-upload fallback. Calls onScan once per decode while `active`. */
export function Scanner({ active, onScan }: { active: boolean; onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onScanRef = useRef(onScan)
  const fileRef = useRef<HTMLInputElement>(null)
  const [camState, setCamState] = useState<'idle' | 'starting' | 'on' | 'denied' | 'none'>('idle')
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([])
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  onScanRef.current = onScan

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const scanner = new QrScanner(video, (res) => onScanRef.current(res.data), {
      preferredCamera: 'environment',
      highlightScanRegion: false,
      maxScansPerSecond: 12,
      returnDetailedScanResult: true,
    })
    scannerRef.current = scanner
    return () => {
      scanner.destroy()
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner) return
    if (!active) {
      scanner.stop()
      setCamState((s) => (s === 'on' ? 'idle' : s))
      return
    }
    let cancelled = false
    ;(async () => {
      if (!(await QrScanner.hasCamera())) {
        setCamState('none')
        return
      }
      setCamState('starting')
      try {
        await scanner.start()
        if (cancelled) return
        setCamState('on')
        setHasFlash(await scanner.hasFlash())
        QrScanner.listCameras(false).then(setCameras).catch(() => {})
      } catch {
        if (!cancelled) setCamState('denied')
      }
    })()
    return () => { cancelled = true }
  }, [active])

  const switchCamera = async () => {
    const next = facing === 'environment' ? 'user' : 'environment'
    setFacing(next)
    await scannerRef.current?.setCamera(next)
  }

  const toggleFlash = async () => {
    await scannerRef.current?.toggleFlash()
    setFlashOn(!!scannerRef.current?.isFlashOn())
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true, alsoTryWithoutScanRegion: true })
      onScanRef.current(res.data)
    } catch {
      toast.error('No QR code found in that image. Try a sharper, well-lit photo.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-950 ring-1 ring-slate-900/10 sm:aspect-[4/3]">
        <video ref={videoRef} className={clsx('size-full object-cover', facing === 'user' && '-scale-x-100')} muted playsInline />

        {/* Viewfinder */}
        {camState === 'on' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative size-[62%] max-w-72 rounded-3xl shadow-[0_0_0_9999px_rgb(2_6_23/0.45)]">
              {['left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'].map((c) => (
                <span key={c} className={clsx('absolute size-10 border-white', c)} />
              ))}
              <span className="absolute inset-x-4 h-0.5 animate-scan rounded-full bg-sky-400 shadow-[0_0_16px_4px_rgb(56_189_248/0.7)]" />
            </div>
          </div>
        )}

        {camState !== 'on' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
            {camState === 'starting' ? <Camera className="size-10 animate-pulse" /> : <CameraOff className="size-10" />}
            <p className="text-sm font-medium">
              {camState === 'starting' && 'Starting camera...'}
              {camState === 'denied' && 'Camera access was blocked. Allow it in your browser, or upload a photo of the QR.'}
              {camState === 'none' && 'No camera found on this device. Upload a QR image or try a sample card.'}
              {camState === 'idle' && 'Scanner paused'}
            </p>
          </div>
        )}

        {camState === 'on' && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            {hasFlash && (
              <button onClick={toggleFlash} className="grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur" aria-label="Toggle flashlight">
                {flashOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
              </button>
            )}
            {cameras.length > 1 && (
              <button onClick={switchCamera} className="grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur" aria-label="Switch camera">
                <SwitchCamera className="size-5" />
              </button>
            )}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button className="btn-secondary w-full" onClick={() => fileRef.current?.click()}>
        <ImageUp className="size-4" /> Upload a QR image instead
      </button>
    </div>
  )
}
