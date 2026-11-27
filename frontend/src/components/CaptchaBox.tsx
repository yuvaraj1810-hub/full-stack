'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'microsoft.com',
]

export function isAllowedEmailDomain(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2) return false
  return ALLOWED_EMAIL_DOMAINS.includes(parts[1])
}

export function generateCaptchaCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

interface CaptchaBoxProps {
  value: string
  onChange: (val: string) => void
  onCodeChange: (code: string) => void
  error?: string | null
}

export default function CaptchaBox({ value, onChange, onCodeChange, error }: CaptchaBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [code, setCode] = useState('')

  const refresh = () => {
    const next = generateCaptchaCode(6)
    setCode(next)
    onCodeChange(next)
    onChange('')
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !code) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and fill background
    ctx.fillStyle = '#eaf2ff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Subtle noise lines
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#adc7ff' : '#94b3e8'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height)
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height)
      ctx.stroke()
    }

    // Draw characters with slight rotation
    ctx.font = 'bold 22px Inter, Arial, sans-serif'
    ctx.textBaseline = 'middle'
    const step = canvas.width / (code.length + 1)
    for (let i = 0; i < code.length; i++) {
      ctx.save()
      const x = step * (i + 1)
      const y = canvas.height / 2 + (Math.random() * 6 - 3)
      ctx.translate(x, y)
      ctx.rotate((Math.random() - 0.5) * 0.35)
      ctx.fillStyle = '#132242'
      ctx.fillText(code[i], -7, 0)
      ctx.restore()
    }
  }, [code])

  return (
    <div className="space-y-2 my-3">
      <span className="block font-semibold text-sm text-[var(--cm-ink)]">
        Security Verification (CAPTCHA)
      </span>
      <div className="flex items-center gap-2.5">
        <canvas
          ref={canvasRef}
          width={180}
          height={46}
          className="rounded-lg border border-[var(--cm-line)] bg-[#eaf2ff] shrink-0"
          aria-label="CAPTCHA security code"
        />
        <button
          type="button"
          onClick={refresh}
          title="Refresh CAPTCHA"
          aria-label="Refresh CAPTCHA"
          className="btn-secondary p-2.5 shrink-0"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <input
        type="text"
        required
        autoComplete="off"
        placeholder="Enter the 6-character code above"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={6}
        className="input-field text-sm tracking-widest uppercase"
      />
      {error && <small className="text-red-500 font-medium block">{error}</small>}
    </div>
  )
}
