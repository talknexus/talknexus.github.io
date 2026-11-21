
import DesktopAuth from './pages/DesktopAuth'
import DesktopLandingPage from './pages/DesktopLandingPage'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import AppHome from './pages/AppHome'
import WhatsNew from './components/WhatsNew'
import { getLatestPublishedRelease } from './lib/whatsNew'
import type { PublishedWhatsNewRelease } from './lib/whatsNew'

import { useEffect, useRef, useState } from 'react'
import { Link, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type DesktopPlatform = 'windows' | 'macos' | 'other'

const GITHUB_RELEASES_URL =
  'https://github.com/talknexus/talknexus.github.io/releases'

function detectDesktopPlatform(): DesktopPlatform {
  const navigatorWithPlatform = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform =
    navigatorWithPlatform.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent
  const normalized = platform.toLowerCase()

  if (normalized.includes('win')) return 'windows'
  if (normalized.includes('mac')) return 'macos'
  return 'other'
}

function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [desktopPlatform, setDesktopPlatform] =
    useState<DesktopPlatform>('other')

  useEffect(() => {
    setDesktopPlatform(detectDesktopPlatform())
  }, [])

  const desktopDownload =
    desktopPlatform === 'windows'
      ? {
          label: 'Download for Windows',
          url: `${GITHUB_RELEASES_URL}/latest/download/NEXUS-Setup.exe`,
        }
      : desktopPlatform === 'macos'
        ? {
            label: 'Download for macOS',
            url: `${GITHUB_RELEASES_URL}/latest/download/NEXUS.dmg`,
          }
        : {
            label: 'Desktop downloads',
            url: GITHUB_RELEASES_URL,
          }

  return (
    <div className="min-h-screen bg-[#17181c] text-[#f2f3f5]">
      <div>
        <header className="flex h-20 items-center justify-between border-b border-[#292a30] px-8 md:px-16">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}nexus-logo-blue.png`}
              alt="NEXUS"
              className="h-10 w-10 rounded-xl object-cover"
            />
            <span className="text-xl font-bold tracking-wide">NEXUS</span>
          </Link>

          <nav className="flex items-center gap-5">
            {isLoggedIn ? (
              <Link
                to="/app"
                className="rounded-lg bg-[#0390fc] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#168ff0]"
              >
                Open NEXUS
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-300 transition hover:text-white"
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className="rounded-lg bg-[#0390fc] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#168ff0]"
                >
                  Join up
                </Link>
              </>
            )}
          </nav>
        </header>

        <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 text-center">
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl md:text-8xl">
            <span className="block text-white">join the</span>
            <span className="inline text-[#0390fc]">fun side</span>
            <span className="inline text-white">.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
            Chat with friends, build spaces, all in one place.
            Best part? It's all about the fun side.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/register"
              className="rounded-xl bg-[#0390fc] px-8 py-3.5 text-sm font-bold text-white transition hover:bg-[#168ff0] hover:shadow-lg hover:shadow-[#0390fc]/20"
            >
              Join the fun (no credit card required)
            </Link>

            <a
              href={desktopDownload.url}
              rel="noopener noreferrer"
              className="rounded-xl border border-[#34353d] px-8 py-3.5 text-sm font-semibold text-white transition hover:border-[#0390fc] hover:bg-[#0390fc]/10"
            >
              {desktopDownload.label}
            </a>
          </div>

          <section id="features" className="mt-28 grid w-full max-w-4xl gap-5 pb-16 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">
              <div className="mb-4 text-2xl">👥</div>
              <h3 className="font-bold">Find your people</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Connect with friends and meet new people.
              </p>
            </div>

            <div className="rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">
              <div className="mb-4 text-2xl">🌐</div>
              <h3 className="font-bold">Build spaces</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Create your own spaces and bring people together.
              </p>
            </div>

            <div className="rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">
              <div className="mb-4 text-2xl">💬</div>
              <h3 className="font-bold">For free, for everyone</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Endlessly talk and connect without paying a dime.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [whatsNewRelease, setWhatsNewRelease] =
    useState<PublishedWhatsNewRelease | null>(null)
  const shownWhatsNewUserRef = useRef<{ userId: string; version: string } | null>(null)
  const location = useLocation()

  const isElectron = Boolean(window.nexusDesktop)

  const loginParams = new URLSearchParams(location.search)
  const loginChallenge = loginParams.get('challenge')

  const loginReturnTo =
    loginParams.get('returnTo') === '/desktop-auth' &&
    loginChallenge &&
    /^[A-Za-z0-9_-]{43}$/.test(loginChallenge)
      ? `/desktop-auth?challenge=${encodeURIComponent(loginChallenge)}`
      : '/app'

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isElectron || loading) return

    const mode = session ? 'app' : 'welcome'

    window.nexusDesktop?.setWindowMode(mode).catch((error) => {
      console.error('Could not change NEXUS window mode:', error)
    })
  }, [isElectron, loading, session])

  useEffect(() => {
    if (!session) {
      shownWhatsNewUserRef.current = null
      setWhatsNewRelease(null)
      return
    }

    const latestRelease = getLatestPublishedRelease()
    if (!latestRelease) {
      setWhatsNewRelease(null)
      return
    }

    const lastSeen = session.user.user_metadata?.last_seen_whats_new
    if (typeof lastSeen === 'string' && lastSeen === latestRelease.version) {
      setWhatsNewRelease(null)
      return
    }

    const alreadyShown =
      shownWhatsNewUserRef.current?.userId === session.user.id &&
      shownWhatsNewUserRef.current.version === latestRelease.version

    if (alreadyShown) return

    shownWhatsNewUserRef.current = {
      userId: session.user.id,
      version: latestRelease.version,
    }
    setWhatsNewRelease(latestRelease)
  }, [loading, session])

  async function dismissWhatsNew(release: PublishedWhatsNewRelease) {
    setWhatsNewRelease(null)

    const { error } = await supabase.auth.updateUser({
      data: {
        last_seen_whats_new: release.version,
      },
    })

    if (error) {
      console.error('Could not save Whats New dismissal:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17181c] text-white">
        <p className="text-gray-400">Loading NEXUS...</p>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            isElectron ? (
              session ? <Navigate to="/app" replace /> : <DesktopLandingPage />
            ) : (
              <LandingPage isLoggedIn={!!session} />
            )
          }
        />

        <Route
          path="/login"
          element={
            isElectron
              ? <Navigate to="/" replace />
              : session
                ? <Navigate to={loginReturnTo} replace />
                : <Login />
          }
        />

        <Route
          path="/register"
          element={
            isElectron
              ? <Navigate to="/" replace />
              : session
                ? <Navigate to="/app" replace />
                : <Register />
          }
        />

        <Route
          path="/desktop-auth"
          element={<DesktopAuth />}
        />

        <Route
          path="/app"
          element={session ? <AppHome /> : <Navigate to="/" replace />}
        />

        <Route
          path="/app/settings"
          element={session ? <Settings /> : <Navigate to="/" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {session && whatsNewRelease && (
        <WhatsNew
          release={whatsNewRelease}
          onClose={() => void dismissWhatsNew(whatsNewRelease)}
        />
      )}
    </>
  )
}

export default App
