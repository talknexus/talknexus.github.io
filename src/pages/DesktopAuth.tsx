
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function DesktopAuth() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const challenge = searchParams.get('challenge')

  const started = useRef(false)
  const [message, setMessage] = useState('Preparing desktop login...')

  useEffect(() => {
    if (started.current) return
    started.current = true

    async function startAuthentication() {
      try {
        if (!challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
          setMessage(
            'Invalid login link. Please start again from the NEXUS desktop app.'
          )
          return
        }

        setMessage('Checking your NEXUS account...')

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          setMessage(
            'Could not verify your session. Please refresh and try again.'
          )
          return
        }

        if (!session) {
          const params = new URLSearchParams({
            returnTo: '/desktop-auth',
            challenge,
          })

          navigate(`/login?${params.toString()}`, { replace: true })
          return
        }

        setMessage('Connecting your NEXUS account to the desktop app...')

        const { data, error } = await supabase.functions.invoke(
          'desktop-auth',
          {
            body: {
              action: 'create',
              code_challenge: challenge,
            },
          }
        )

        if (error) {
          let status: number | undefined

          if (error.context instanceof Response) {
            status = error.context.status
          } else if (
            typeof error.context === 'object' &&
            error.context !== null &&
            'status' in error.context
          ) {
            const value = error.context.status

            if (typeof value === 'number') {
              status = value
            }
          }

          if (status === 429) {
            setMessage(
              'Cooldown active. Please wait 10 seconds before trying again.'
            )
          } else if (status === 401) {
            setMessage(
              'Your browser session has expired. Please log in again.'
            )
          } else if (!status) {
            setMessage(
              'Connection problem. Check your internet and try again.'
            )
          } else {
            setMessage('Could not start desktop login. Please try again.')
          }

          return
        }

        if (!data?.code || !/^[a-f0-9]{64}$/.test(data.code)) {
          setMessage(
            'Could not create a login token. Please try again.'
          )
          return
        }

        setMessage('Login approved! Returning to the NEXUS desktop app...')

        window.location.href =
          `nexus://auth/callback?code=${encodeURIComponent(data.code)}`
      } catch {
        setMessage(
          'Something went wrong. Please refresh and try again.'
        )
      }
    }

    startAuthentication()
  }, [challenge, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#17181c] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#34353d] bg-[#1e1f24] p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0390fc] text-2xl font-black">
          N
        </div>

        <h1 className="mt-6 text-3xl font-black">
          NEXUS <span className="text-[#0390fc]">Desktop</span>
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          {message}
        </p>

        {(message.includes('try again') ||
          message.includes('refresh') ||
          message.includes('wait 10 seconds')) && (
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-[#0390fc] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#168ff0]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

export default DesktopAuth
