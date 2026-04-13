import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="border-b border-dedsec-border bg-dedsec-card px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-xl font-bold text-dedsec-green glow-green animate-flicker"
        >
          ☠️ DEDSEC
        </button>
        <div className="flex items-center gap-6">
          <span className="text-dedsec-muted text-xs hidden sm:block">{user?.email}</span>
          <button
            onClick={() => navigate('/scan')}
            className="border border-dedsec-green text-dedsec-green px-4 py-2 rounded text-xs tracking-wider uppercase hover:bg-dedsec-green hover:text-black transition-all"
          >
            + New Scan
          </button>
          <button
            onClick={handleSignOut}
            className="text-dedsec-muted text-xs hover:text-white transition-colors tracking-wider uppercase"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}