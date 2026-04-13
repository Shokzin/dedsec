import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) { setError(error) } else { navigate('/dashboard') }
    } else {
      const { error } = await signUp(email, password)
      if (error) { setError(error) } else { setSuccess('Account created! Check your email to confirm.') }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-dedsec-bg flex items-center justify-center px-4">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-dedsec-green glow-green animate-flicker mb-2">☠️ DEDSEC</h1>
          <p className="text-dedsec-muted text-sm tracking-widest uppercase">Vulnerability Analysis Platform</p>
        </div>
        <div className="bg-dedsec-card border border-dedsec-border rounded-lg p-8 border-glow-green">
          <div className="flex mb-8 border border-dedsec-border rounded-md overflow-hidden">
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium transition-all ${mode === 'login' ? 'bg-dedsec-green text-black' : 'text-dedsec-muted hover:text-white'}`}
            >LOGIN</button>
            <button
              onClick={() => { setMode('register'); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium transition-all ${mode === 'register' ? 'bg-dedsec-green text-black' : 'text-dedsec-muted hover:text-white'}`}
            >REGISTER</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-dedsec-muted mb-1 tracking-wider uppercase">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="operator@dedsec.net"
                className="w-full bg-dedsec-bg border border-dedsec-border rounded px-4 py-3 text-sm text-white placeholder-dedsec-muted focus:outline-none focus:border-dedsec-green transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-dedsec-muted mb-1 tracking-wider uppercase">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••••••"
                className="w-full bg-dedsec-bg border border-dedsec-border rounded px-4 py-3 text-sm text-white placeholder-dedsec-muted focus:outline-none focus:border-dedsec-green transition-colors"
              />
            </div>
          </div>
          {error && <div className="mt-4 p-3 border border-dedsec-red/50 bg-dedsec-red/10 rounded text-dedsec-red text-xs">⚠ {error}</div>}
          {success && <div className="mt-4 p-3 border border-dedsec-green/50 bg-dedsec-green/10 rounded text-dedsec-green text-xs">✓ {success}</div>}
          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="mt-6 w-full bg-dedsec-green text-black font-bold py-3 rounded text-sm tracking-widest uppercase hover:bg-green-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'CONNECTING...' : mode === 'login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
          </button>
        </div>
        <p className="text-center text-dedsec-muted text-xs mt-6">We are everywhere.</p>
      </div>
    </div>
  )
}