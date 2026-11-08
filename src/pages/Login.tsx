
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (error) {
      setError('Incorrect email or password. Please try again.')
      return
    }

    navigate('/app')
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

        <form onSubmit={handleLogin} className="mt-8 space-y-5">

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
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
            disabled={loading}
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
