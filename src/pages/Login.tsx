import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  generatePkcePair,
  redeemDesktopAuthCode,
  signInWithUsernameOrEmail,
} from '../lib/desktopAuth'

function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const challenge = searchParams.get('challenge')

  const returnTo =
    searchParams.get('returnTo') === '/desktop-auth' &&
    challenge &&
    /^[A-Za-z0-9_-]{43}$/.test(challenge)
      ? `/desktop-auth?challenge=${encodeURIComponent(challenge)}`
      : '/app'

  const isElectron = Boolean(window.nexusDesktop)
  const browserLoginStarted = useRef(false)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserMessage, setBrowserMessage] = useState('')

  useEffect(() => {
    if (!window.nexusDesktop) return

    const unsubscribe = window.nexusDesktop.onAuthCallback(async (url) => {
      setBrowserLoading(true)
      setBrowserMessage('Completing desktop login...')
      setError('')

      try {
        const callbackUrl = new URL(url)

        if (
          callbackUrl.protocol !== 'nexus:' ||
          callbackUrl.hostname !== 'auth' ||
          callbackUrl.pathname !== '/callback' ||
          callbackUrl.username ||
          callbackUrl.password ||
          callbackUrl.port ||
          callbackUrl.hash ||
          callbackUrl.searchParams.size !== 1
        ) {
          throw new Error('Invalid desktop authentication callback.')
        }

        const code = callbackUrl.searchParams.get('code')

        if (!code || !/^[a-f0-9]{64}$/.test(code)) {
          throw new Error('The desktop login code is invalid.')
        }

        const verifier = sessionStorage.getItem(
          'nexus-desktop-pkce-verifier'
        )

        if (!verifier) {
          throw new Error(
            'Your login session expired. Please start browser login again.'
          )
        }

        await redeemDesktopAuthCode(code, verifier)
        sessionStorage.removeItem('nexus-desktop-pkce-verifier')

        navigate('/app', { replace: true })
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not complete desktop login.'
        )
        setBrowserMessage('')
      } finally {
        setBrowserLoading(false)
      }
    })

    return unsubscribe
  }, [navigate])

  useEffect(() => {
    if (
      !isElectron ||
      searchParams.get('startBrowser') !== '1' ||
      browserLoginStarted.current
    ) {
      return
    }

    browserLoginStarted.current = true
    void handleBrowserLogin()
  }, [isElectron, searchParams])

  async function handleBrowserLogin() {
    if (!window.nexusDesktop) return

    setError('')
    setBrowserMessage('')
    setBrowserLoading(true)

    try {
      const { verifier, challenge } = await generatePkcePair()

      sessionStorage.setItem(
        'nexus-desktop-pkce-verifier',
        verifier
      )

      const authUrl = new URL(
        'https://nexus.qwertydev.me/desktop-auth'
      )

      authUrl.searchParams.set('challenge', challenge)

      await window.nexusDesktop.openBrowserAuth(authUrl.toString())

      setBrowserMessage(
        'Your browser has opened. Complete the login there to return to NEXUS.'
      )
    } catch {
      sessionStorage.removeItem('nexus-desktop-pkce-verifier')
      setError('Could not open browser authentication. Please try again.')
    } finally {
      setBrowserLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithUsernameOrEmail(identifier, password)
      navigate(returnTo)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Incorrect username/email or password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17181c] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#34353d] bg-[#1e1f24] p-8 shadow-xl">
        <Link to="/" className="text-sm font-semibold text-[#0390fc] hover:underline">
          ← Back to NEXUS
        </Link>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-black">
            Welcome back to <span className="text-[#0390fc]">NEXUS</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Log in and get back to the fun side.
          </p>
        </div>

        {isElectron && (
          <>
            <button
              type="button"
              onClick={handleBrowserLogin}
              disabled={browserLoading}
              className="mt-8 w-full rounded-lg border border-[#34353d] bg-[#17181c] py-3 font-bold text-white transition hover:border-[#0390fc] hover:bg-[#0390fc]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {browserLoading ? 'Connecting...' : 'Log in with browser'}
            </button>

            {browserMessage && (
              <p className="mt-3 text-center text-sm text-gray-400">
                {browserMessage}
              </p>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#34353d]" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="h-px flex-1 bg-[#34353d]" />
            </div>
          </>
        )}

        <form onSubmit={handleLogin} className={isElectron ? 'space-y-5' : 'mt-8 space-y-5'}>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Username or email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="Your username or email"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || browserLoading}
            className="w-full rounded-lg bg-[#0390fc] py-3 font-bold text-white transition hover:bg-[#168ff0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          New to NEXUS?{' '}
          <Link to="/register" className="font-semibold text-[#0390fc] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login