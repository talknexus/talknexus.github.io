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

    const [dmResult, groupMembershipResult, messageResult] = await Promise.all([
      supabase
        .from('dm_conversations')
        .select('*')
        .eq('is_group', false)
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`),
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, role, joined_at')
        .eq('user_id', currentUserId),
      supabase
        .from('dm_messages')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (dmResult.error || groupMembershipResult.error || messageResult.error) {
      setPageError(
        dmResult.error?.message ||
          groupMembershipResult.error?.message ||
          messageResult.error?.message ||
          'Could not load conversations.',
      )
      setLoadingConversations(false)
      return
    }

    const dmRows = (dmResult.data || []) as Conversation[]
    const memberships = (groupMembershipResult.data || []) as {
      conversation_id: string
      user_id: string
      role: 'owner' | 'member'
      joined_at: string
    }[]
    const groupIds = [...new Set(memberships.map((member) => member.conversation_id))]

    let groupRows: Conversation[] = []
    if (groupIds.length > 0) {
      const groupResult = await supabase
        .from('dm_conversations')
        .select('*')
        .eq('is_group', true)
        .in('id', groupIds)

      if (groupResult.error) {
        setPageError(groupResult.error.message)
        setLoadingConversations(false)
        return
      }
      groupRows = (groupResult.data || []) as Conversation[]
    }

    const conversationRows = [...dmRows, ...groupRows]
    if (conversationRows.length === 0) {
      setConversations([])
      clearActiveConversation()
      setLoadingConversations(false)
      return
    }

    const dmOtherUserIds = dmRows
      .map((conversation) =>
        conversation.user1_id === currentUserId
          ? conversation.user2_id
          : conversation.user1_id,
      )
      .filter((id): id is string => Boolean(id))

    const allMemberUserIds = groupRows.length > 0
      ? memberships
          .filter((member) =>
            groupIds.includes(member.conversation_id),
          )
          .map((member) => member.user_id)
      : []

    let groupMemberRows: {
      conversation_id: string
      user_id: string
      role: 'owner' | 'member'
      joined_at: string
    }[] = memberships

    if (groupIds.length > 0) {
      const membersResult = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, role, joined_at')
        .in('conversation_id', groupIds)

      if (membersResult.error) {
        setPageError(membersResult.error.message)
        setLoadingConversations(false)
        return
      }
      groupMemberRows = (membersResult.data || []) as typeof groupMemberRows
    }

    const relevantConversationIds = new Set(
      conversationRows.map((conversation) => conversation.id),
    )
    const relevantMessages = (messageResult.data || []) as DmMessage[]
    const historicalSenderIds = relevantMessages
      .filter((message) => relevantConversationIds.has(message.conversation_id))
      .map((message) => message.sender_id)

    const profileUserIds = [
      ...new Set([
        ...dmOtherUserIds,
        ...allMemberUserIds,
        ...groupMemberRows.map((member) => member.user_id),
        ...historicalSenderIds,
      ]),
    ]

    const profileResult = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, banner_url, bio')
      .in('id', profileUserIds)

    if (profileResult.error) {
      setPageError(profileResult.error.message)
      setLoadingConversations(false)
      return
    }

    const profileMap = new Map(
      ((profileResult.data || []) as Profile[]).map((profile) => [profile.id, profile]),
    )

    const latestMessages = new Map<string, DmMessage>()

    for (const message of relevantMessages) {
      if (!relevantConversationIds.has(message.conversation_id)) continue
      if (!latestMessages.has(message.conversation_id)) {
        latestMessages.set(message.conversation_id, message)
      }
    }

    const entries: ConversationEntry[] = conversationRows
      .map((conversation): ConversationEntry | null => {
        if (conversation.is_group) {
          const members = groupMemberRows
            .filter((member) => member.conversation_id === conversation.id)
            .map((member) => profileMap.get(member.user_id))
            .filter((profile): profile is Profile => Boolean(profile))

          const memberRoles = Object.fromEntries(
            groupMemberRows
              .filter((member) => member.conversation_id === conversation.id)
              .map((member) => [member.user_id, member.role]),
          )

          const senderProfiles = Object.fromEntries(
            relevantMessages
              .filter((message) => message.conversation_id === conversation.id)
              .map((message) => message.sender_id)
              .filter((senderId, index, senderIds) =>
                senderIds.indexOf(senderId) === index,
              )
              .map((senderId) => [senderId, profileMap.get(senderId)])
              .filter(
                (entry): entry is [string, Profile] =>
                  Boolean(entry[1]),
              ),
          )

          const groupProfile: Profile = {
            id: conversation.id,
            username: conversation.name?.toLowerCase().replace(/\s+/g, '-') || 'group',
            display_name: conversation.name || 'Group',
            avatar_url: conversation.avatar_url,
          }

          return {
            conversation,
            profile: groupProfile,
            lastMessage: latestMessages.get(conversation.id) || null,
            members,
            memberRoles,
            senderProfiles,
          }
        }

        const otherUserId =
          conversation.user1_id === currentUserId
            ? conversation.user2_id
            : conversation.user1_id

        if (!otherUserId) return null

        const otherProfile = profileMap.get(otherUserId)

        if (!otherProfile) return null

        return {
          conversation,
          profile: otherProfile,
          lastMessage: latestMessages.get(conversation.id) || null,
        }
      })
      .filter((entry): entry is ConversationEntry => entry !== null)
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
