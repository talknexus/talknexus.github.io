
import { supabase } from './supabase'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function generatePkcePair(): Promise<{
  verifier: string
  challenge: string
}> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64UrlEncode(randomBytes)

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )

  const challenge = base64UrlEncode(new Uint8Array(digest))

  return { verifier, challenge }
}

export async function redeemDesktopAuthCode(
  code: string,
  verifier: string
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('desktop-auth', {
    body: {
      action: 'redeem',
      code,
      verifier,
    },
  })

  if (error || !data?.token_hash || data.type !== 'magiclink') {
    throw new Error(
      data?.error || 'Could not redeem the desktop login code.'
    )
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: 'magiclink',
  })

  if (verifyError) {
    throw new Error('Could not establish your NEXUS desktop session.')
  }
}
