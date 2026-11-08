import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'

import type {
  Profile,
  Conversation,
  DmMessage,
  ConversationEntry,
} from '../types'

type UseConversationsProps = {
  setPageError: Dispatch<SetStateAction<string>>
  clearActiveConversation: () => void
}

export default function useConversations({
  setPageError,
  clearActiveConversation,
}: UseConversationsProps) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)

  const loadConversations = useCallback(async (currentUserId: string) => {
    if (!currentUserId) return

    setLoadingConversations(true)

    const { data: conversationData, error: conversationError } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)

    if (conversationError) {
      setPageError(conversationError.message)
      setLoadingConversations(false)
      return
    }

    const conversationRows = (conversationData || []) as Conversation[]

    if (conversationRows.length === 0) {
      setConversations([])
      clearActiveConversation()
      setLoadingConversations(false)
      return
    }

    const otherUserIds = conversationRows.map((conversation) =>
      conversation.user1_id === currentUserId
        ? conversation.user2_id
        : conversation.user1_id,
    )

    const [profileResult, messageResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, banner_url, bio')
        .in('id', otherUserIds),

      supabase
        .from('dm_messages')
        .select('*')
        .in(
          'conversation_id',
          conversationRows.map((conversation) => conversation.id),
        )
        .order('created_at', { ascending: false }),
    ])

    if (profileResult.error || messageResult.error) {
      setPageError(
        profileResult.error?.message ||
          messageResult.error?.message ||
          'Could not load conversations.',
      )
      setLoadingConversations(false)
      return
    }

    const profileMap = new Map(
      ((profileResult.data || []) as Profile[]).map((p) => [p.id, p]),
    )

    const latestMessages = new Map<string, DmMessage>()

    for (const message of (messageResult.data || []) as DmMessage[]) {
      if (!latestMessages.has(message.conversation_id)) {
        latestMessages.set(message.conversation_id, message)
      }
    }

    const entries: ConversationEntry[] = conversationRows
      .map((conversation) => {
        const otherUserId =
          conversation.user1_id === currentUserId
            ? conversation.user2_id
            : conversation.user1_id

        const otherProfile = profileMap.get(otherUserId)

        if (!otherProfile) return null

        return {
          conversation,
          profile: otherProfile,
          lastMessage: latestMessages.get(conversation.id) || null,
        }
      })
      .filter((entry): entry is ConversationEntry => Boolean(entry))
      .sort((a, b) => {
        const dateA = a.lastMessage?.created_at || a.conversation.created_at
        const dateB = b.lastMessage?.created_at || b.conversation.created_at

        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })

    setConversations(entries)
    setLoadingConversations(false)
  }, [setPageError, clearActiveConversation])

  return {
    conversations,
    loadingConversations,
    loadConversations,
  }
}
