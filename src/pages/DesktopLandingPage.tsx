import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  generatePkcePair,
  redeemDesktopAuthCode,
  signInWithUsernameOrEmail,
} from '../lib/desktopAuth'
import { supabase } from '../lib/supabase'

type View = 'welcome' | 'login' | 'register'

function DesktopLandingPage() {
  const navigate = useNavigate()

  const [view, setView] = useState<View>('welcome')
  const [registerStep, setRegisterStep] = useState(1)

  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserMessage, setBrowserMessage] = useState('')

  function changeView(nextView: View) {
    setView(nextView)
    setError('')
    setSuccess('')

    if (nextView === 'register') {
      setRegisterStep(1)
    }
  }

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
            'Your login session expired. Please try browser login again.'
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

  async function handleBrowserLogin() {
    if (!window.nexusDesktop || browserLoading) return

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
        'Your browser has opened. Complete login there to return to NEXUS.'
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
      navigate('/app', { replace: true })
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

  function validateRegisterStepOne() {
    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim()

    if (!/^[a-z0-9]{3,24}$/.test(cleanUsername)) {
      setError(
        'Username must be 3–24 characters and contain only lowercase letters and numbers.'
      )
      return false
    }

    if (cleanDisplayName.length < 1 || cleanDisplayName.length > 32) {
      setError('Display name must be between 1 and 32 characters.')
      return false
    }

    return true
  }

  function continueRegistration() {
    setError('')

    if (registerStep === 1 && !validateRegisterStepOne()) return

    if (registerStep === 2 && !email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setRegisterStep((current) => Math.min(current + 1, 3))
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim()

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplayName,
          },
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(
        'Account created! Check your email and click the confirmation link before logging in.'
      )
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#34353d] bg-[#17181c] px-3 py-2 text-sm text-white outline-none transition focus:border-[#0390fc]'

  const labelClass = 'mb-1 block text-xs font-semibold text-gray-300'

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#17181c] text-white">
      <div className="electron-drag-region" />

      {/* Left authentication panel */}
      <section className="flex h-full w-1/2 items-center justify-center overflow-y-auto bg-[#17181c] px-8 py-8">
        <div className="my-auto w-full max-w-[370px] py-3">

          {view === 'welcome' && (
            <div className="text-center">
              <div className="mb-5">
                <img
                  src={`${import.meta.env.BASE_URL}nexus-logo-blue.png`}
                  alt="NEXUS"
                  className="mx-auto mb-3 h-12 w-12 rounded-xl object-cover"
                />

                <h1 className="text-2xl font-black tracking-tight">
                  Welcome back to <span className="text-[#0390fc]">NEXUS</span>
                </h1>

                <p className="mt-2 text-xs leading-relaxed text-gray-400">
                  We're so glad to see you again!
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => changeView('login')}
                  className="w-full rounded-lg bg-[#0390fc] py-2.5 text-sm font-bold transition hover:bg-[#168ff0]"
                >
                  Log in
                </button>

                <button
                  onClick={() => changeView('register')}
                  className="w-full rounded-lg border border-[#34353d] bg-[#222329] py-2.5 text-sm font-bold transition hover:border-[#0390fc] hover:bg-[#0390fc]/10"
                >
                  Sign up
                </button>
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#34353d]" />
                <span className="text-[10px] text-gray-500">OR</span>
                <div className="h-px flex-1 bg-[#34353d]" />
              </div>

              <button
                onClick={handleBrowserLogin}
                disabled={browserLoading}
                className="w-full rounded-lg bg-[#303137] py-2.5 text-xs font-semibold transition hover:bg-[#3b3c43] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {browserLoading ? 'Connecting...' : 'Log in with browser'}
              </button>

              {browserMessage && (
                <p className="mt-2 text-xs text-gray-400">
                  {browserMessage}
                </p>
              )}

              {error && (
                <p className="mt-3 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
                  {error}
                </p>
              )}
            </div>
          )}

          {view === 'login' && (
            <div>
              <button
                onClick={() => changeView('welcome')}
                className="text-xs font-semibold text-[#0390fc] hover:underline"
              >
                ← Back
              </button>

              <h1 className="mt-4 text-2xl font-black">
                Welcome <span className="text-[#0390fc]">back.</span>
              </h1>

              <p className="mt-1 text-xs text-gray-400">
                Log in to continue to NEXUS.
              </p>

              <form onSubmit={handleLogin} className="mt-5 space-y-3">
                <div>
                  <label className={labelClass}>Username or email</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="Your username or email"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Your password"
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || browserLoading}
                  className="w-full rounded-lg bg-[#0390fc] py-2.5 text-sm font-bold transition hover:bg-[#168ff0] disabled:opacity-50"
                >
                  {loading ? 'Logging in...' : 'Log in'}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-gray-400">
                New to NEXUS?{' '}
                <button
                  onClick={() => changeView('register')}
                  className="font-semibold text-[#0390fc] hover:underline"
                >
                  Sign up
                </button>
              </p>
            </div>
          )}

          {view === 'register' && (
            <div>
              <button
                onClick={() => changeView('welcome')}
                className="text-xs font-semibold text-[#0390fc] hover:underline"
              >
                ← Back
              </button>

              <h1 className="mt-4 text-2xl font-black">
                Join <span className="text-[#0390fc]">NEXUS.</span>
              </h1>

              <p className="mt-1 text-xs text-gray-400">
                Create your account to start chatting!
              </p>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Step {registerStep} of 3</span>
                  <span>{Math.round((registerStep / 3) * 100)}% complete</span>
                </div>

                <div className="flex gap-2">
                  {[1, 2, 3].map((number) => (
                    <div
                      key={number}
                      className={`h-1.5 flex-1 rounded-full ${
                        number <= registerStep
                          ? 'bg-[#0390fc]'
                          : 'bg-[#34353d]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleRegister}
                className="mt-4"
              >
                {registerStep === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Username</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        minLength={3}
                        maxLength={24}
                        pattern="[A-Za-z0-9]+"
                        autoComplete="username"
                        placeholder="qwertydev12"
                        className={inputClass}
                      />
                      <p className="mt-1 text-[10px] text-gray-500">
                        3–24 letters or numbers. Usernames are unique.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>Display name</label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        maxLength={32}
                        autoComplete="nickname"
                        placeholder="Your display name"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {registerStep === 2 && (
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>
                )}

                {registerStep === 3 && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Confirm password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="mt-3 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-400">
                    {error}
                  </p>
                )}

                {success && (
                  <p className="mt-3 rounded-lg bg-green-500/10 p-2.5 text-xs text-green-400">
                    {success}
                  </p>
                )}

                {!success && (
                  <div className="mt-4 flex gap-2">
                    {registerStep > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setError('')
                          setRegisterStep((current) => current - 1)
                        }}
                        disabled={loading}
                        className="flex-1 rounded-lg border border-[#34353d] bg-[#222329] py-2.5 text-xs font-bold transition hover:border-[#0390fc] disabled:opacity-50"
                      >
                        Back
                      </button>
                    )}

                    {registerStep < 3 ? (
                      <button
                        type="button"
                        onClick={continueRegistration}
                        className="flex-1 rounded-lg bg-[#0390fc] py-2.5 text-xs font-bold transition hover:bg-[#168ff0]"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 rounded-lg bg-[#0390fc] py-2.5 text-xs font-bold transition hover:bg-[#168ff0] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Creating account...' : 'Create account'}
                      </button>
                    )}
                  </div>
                )}
              </form>

              <p className="mt-4 text-center text-xs text-gray-400">
                Already have an account?{' '}
                <button
                  onClick={() => changeView('login')}
                  className="font-semibold text-[#0390fc] hover:underline"
                >
                  Log in
                </button>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Right blue panel */}
      <section className="flex h-full w-1/2 items-center justify-center bg-[#0390fc]">
        <div className="select-none text-center">
          <img
            src={`${import.meta.env.BASE_URL}nexus-logo-white.png`}
            alt="NEXUS"
            className="mx-auto h-32 w-32 object-contain"
          />

          <p className="mt-2 text-[10px] font-bold tracking-[0.35em] text-white/80">
            WELCOME TO THE FUN SIDE
          </p>
        </div>
      </section>
    </div>
  )
}

export default DesktopLandingPage