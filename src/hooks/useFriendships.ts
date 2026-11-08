import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'

import type {
  Profile,
  Friendship,
  FriendEntry,
  SettingsProfile,
} from '../types'

type UseFriendshipsProps = {
  userId: string
  profile: SettingsProfile | null
  setPageError: Dispatch<SetStateAction<string>>
}

export default function useFriendships({
  userId,
  profile,
  setPageError,
}: UseFriendshipsProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendEntry[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendEntry[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [requestLoading, setRequestLoading] = useState<string | null>(null)

  const [friendError, setFriendError] = useState('')
  const [friendSuccess, setFriendSuccess] = useState('')
  const [addingFriend, setAddingFriend] = useState(false)

  const loadFriendships = useCallback(async (currentUserId: string) => {
    if (!currentUserId) return

    setLoadingFriends(true)
    setPageError('')

    const [incomingResult, outgoingResult, acceptedResult] = await Promise.all([
      supabase
        .from('friendships')
        .select('*')
        .eq('addressee_id', currentUserId)
        .eq('status', 'pending'),

      supabase
        .from('friendships')
        .select('*')
        .eq('requester_id', currentUserId)
        .eq('status', 'pending'),

      supabase
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`),
    ])

    if (incomingResult.error || outgoingResult.error || acceptedResult.error) {
      setPageError(
        incomingResult.error?.message ||
          outgoingResult.error?.message ||
          acceptedResult.error?.message ||
          'Could not load friendships.',
      )
      setLoadingFriends(false)
      return
    }

    const incoming = (incomingResult.data || []) as Friendship[]
    const outgoing = (outgoingResult.data || []) as Friendship[]
    const accepted = (acceptedResult.data || []) as Friendship[]

    const otherUserIds = [
      ...incoming.map((f) => f.requester_id),
      ...outgoing.map((f) => f.addressee_id),
      ...accepted.map((f) =>
        f.requester_id === currentUserId ? f.addressee_id : f.requester_id,
      ),
    ]

    const uniqueIds = [...new Set(otherUserIds)]

    if (uniqueIds.length === 0) {
      setIncomingRequests([])
      setOutgoingRequests([])
      setFriends([])
      setLoadingFriends(false)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, banner_url, bio')
      .in('id', uniqueIds)

    if (profilesError) {
      setPageError(profilesError.message)
      setLoadingFriends(false)
      return
    }

    const profileMap = new Map(
      ((profiles || []) as Profile[]).map((p) => [p.id, p]),
    )

    function makeEntries(
      rows: Friendship[],
      getOtherId: (f: Friendship) => string,
    ): FriendEntry[] {
      return rows
        .map((friendship) => ({
          friendship,
          profile: profileMap.get(getOtherId(friendship)),
        }))
        .filter((item): item is FriendEntry => Boolean(item.profile))
    }

    setIncomingRequests(makeEntries(incoming, (f) => f.requester_id))
    setOutgoingRequests(makeEntries(outgoing, (f) => f.addressee_id))

    setFriends(
      makeEntries(accepted, (f) =>
        f.requester_id === currentUserId ? f.addressee_id : f.requester_id,
      ),
    )

    setLoadingFriends(false)
  }, [setPageError])

  const sendFriendRequest = useCallback(async (friendUsername: string) => {
    const cleanUsername = friendUsername.trim().toLowerCase()

    setFriendError('')
    setFriendSuccess('')

    if (!cleanUsername) {
      setFriendError('Enter a username.')
      return false
    }

    if (cleanUsername === profile?.username.toLowerCase()) {
      setFriendError('You cannot add yourself.')
      return false
    }

    setAddingFriend(true)

    const { data: target, error: lookupError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (lookupError || !target) {
      setFriendError('No user found with that username.')
      setAddingFriend(false)
      return false
    }

    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        requester_id: userId,
        addressee_id: target.id,
        status: 'pending',
      })

    setAddingFriend(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setFriendError('A friendship or request already exists with this user.')
      } else {
        setFriendError(insertError.message)
      }
      return false
    }

    setFriendSuccess(`Friend request sent to ${target.display_name}!`)
    await loadFriendships(userId)

    return true
  }, [profile, userId, loadFriendships])

  const respondToRequest = useCallback(async (
    requestId: string,
    accept: boolean,
  ) => {
    setRequestLoading(requestId)
    setPageError('')

    const { error } = await supabase.rpc('respond_to_friend_request', {
      p_request_id: requestId,
      p_accept: accept,
    })

    setRequestLoading(null)

    if (error) {
      setPageError(error.message)
      return
    }

    await loadFriendships(userId)
  }, [userId, loadFriendships, setPageError])

  const unfriend = useCallback(async (
    friendshipId: string,
    displayName: string,
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to unfriend ${displayName}?`,
    )

    if (!confirmed) return

    setRequestLoading(friendshipId)
    setPageError('')

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    setRequestLoading(null)

    if (error) {
      setPageError(`Could not unfriend ${displayName}: ${error.message}`)
      return
    }

    await loadFriendships(userId)
  }, [userId, loadFriendships, setPageError])

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    loadingFriends,
    requestLoading,
    friendError,
    friendSuccess,
    addingFriend,
    loadFriendships,
    sendFriendRequest,
    respondToRequest,
    unfriend,
    setFriendError,
    setFriendSuccess,
  }
}
