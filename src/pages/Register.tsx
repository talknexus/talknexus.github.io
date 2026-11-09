import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Register() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim()

    if (!/^[a-z0-9]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3–24 characters and contain only lowercase letters and numbers.')
      return
    }

    if (cleanDisplayName.length < 1 || cleanDisplayName.length > 32) {
      setError('Display name must be between 1 and 32 characters.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

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

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(
      'Account created! Please check your email and click the confirmation link before logging in.'
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17181c] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#34353d] bg-[#1e1f24] p-8 shadow-xl">

        <Link to="/" className="text-sm font-semibold text-[#0390fc] hover:underline">
          ← Back to NEXUS
        </Link>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-black">
            Join <span className="text-[#0390fc]">NEXUS</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Create your account and join the fun side.
          </p>
        </div>

        <form onSubmit={handleRegister} className="mt-8 space-y-4">

          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9]+"
              autoComplete="username"
              placeholder="qwertydev12"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
            <p className="mt-1 text-xs text-gray-500">
              3–24 letters or numbers. Usernames are unique.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={32}
              autoComplete="nickname"
              placeholder="Your display name"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
          </div>

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
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
              {success}
            </p>
          )}

          <div className="h-captcha" data-sitekey="dd1410e2-31ee-44e8-b940-f484b02295f0"></div>
          <script src="https://js.hcaptcha.com/1/api.js" async defer></script>

          <button
            type="submit"
            disabled={loading || !!success}
            className="w-full rounded-lg bg-[#0390fc] py-3 font-bold text-white transition hover:bg-[#168ff0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#0390fc] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register
