import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import AppHome from './pages/AppHome'

import { useEffect, useState } from 'react'
import { Link, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="min-h-screen bg-[#17181c] text-[#f2f3f5]">

      {/* Navigation */}
      <header className="flex h-20 items-center justify-between border-b border-[#292a30] px-8 md:px-16">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0390fc] text-xl font-bold text-white">
            N
          </div>
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

      {/* Hero */}
      <main className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 text-center">

        <div className="mb-6"></div>

        <h1 className="text-5xl font-black tracking-tight sm:text-7xl md:text-8xl">
          <span className="block text-white">join the</span>
          <span className="inline text-[#0390fc]">fun side</span><span className="inline text-white">.</span>
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
            href="#features"
            className="rounded-xl border border-[#34353d] px-8 py-3.5 text-sm font-semibold text-white transition hover:border-[#0390fc] hover:bg-[#0390fc]/10"
          >
            Learn More
          </a>
        </div>

        {/* Features */}
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
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Check whether a session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setSession(session)
        setLoading(false)
      }
    })

    // Listen for login, logout and session changes
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

  // Show a loading screen while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17181c] text-white">
        <p className="text-gray-400">Loading NEXUS...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage isLoggedIn={!!session} />} />

      <Route
        path="/login"
        element={session ? <Navigate to="/app" replace /> : <Login />}
      />

      <Route
        path="/register"
        element={session ? <Navigate to="/app" replace /> : <Register />}
      />

      <Route
        path="/app"
        element={session ? <AppHome /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/app/settings"
        element={session ? <Settings /> : <Navigate to="/login" replace />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
