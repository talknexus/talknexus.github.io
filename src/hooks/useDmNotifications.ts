import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ConversationEntry } from '../types'

type UseDmNotificationsProps = {
  userId: string
  conversations: ConversationEntry[]
  activeConversationId: string | null
}

type MessageEvent = {
  id: string
  conversation_id: string
  sender_id: string
  created_at: string
}

type ReadTimestamps = Record<string, string>

function getStorageKey(userId: string) {
  return `nexus-dm-read-${userId}`
}

function readTimestamps(userId: string): ReadTimestamps {
  try {
    const stored = localStorage.getItem(getStorageKey(userId))
    return stored ? JSON.parse(stored) as ReadTimestamps : {}
  } catch {
    return {}
  }
}

function saveTimestamps(userId: string, timestamps: ReadTimestamps) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(timestamps))
}

export default function useDmNotifications({
  userId,
  conversations,
  activeConversationId,
}: UseDmNotificationsProps) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  // Load unread messages and listen for incoming messages.
  useEffect(() => {
    if (!userId || conversations.length === 0) {
      setUnreadCounts({})
      return
    }

    let cancelled = false
    let initialLoadComplete = false

    const conversationIds = conversations.map(
      (entry) => entry.conversation.id,
    )

    const readTimestamps = readTimestampsForUser(userId)
    const now = new Date().toISOString()

    // Establish a starting point for conversations never opened before.
    for (const id of conversationIds) {
      if (!readTimestamps[id]) {
        readTimestamps[id] = now
      }
    }

    saveTimestamps(userId, readTimestamps)

    const receivedDuringLoad: MessageEvent[] = []

    const channel = supabase
      .channel(`dm-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
        },
        (payload) => {
          const message = payload.new as MessageEvent

          if (
            message.sender_id === userId ||
            !conversationIds.includes(message.conversation_id)
          ) {
            return
          }

          if (!initialLoadComplete) {
            receivedDuringLoad.push(message)
            return
          }

          if (message.conversation_id === activeConversationId) {
            readTimestamps[message.conversation_id] = message.created_at
            saveTimestamps(userId, readTimestamps)
            return
          }

          setUnreadCounts((previous) => ({
            ...previous,
            [message.conversation_id]:
              (previous[message.conversation_id] || 0) + 1,
          }))
        },
      )
      .subscribe()

    async function loadUnreadMessages() {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('id, conversation_id, sender_id, created_at')
        .in('conversation_id', conversationIds)

      if (cancelled) return

      if (error) {
        console.error('Could not load unread messages:', error.message)
        initialLoadComplete = true
        return
      }

      const messages = (data || []) as MessageEvent[]
      const messageIds = new Set(messages.map((message) => message.id))
      const counts: Record<string, number> = {}

      for (const message of messages) {
        if (
          message.sender_id !== userId &&
          message.conversation_id !== activeConversationId &&
          message.created_at > readTimestamps[message.conversation_id]
        ) {
          counts[message.conversation_id] =
            (counts[message.conversation_id] || 0) + 1
        }
      }

      // Include realtime messages received while the initial query was running,
      // without counting any message twice.
      for (const message of receivedDuringLoad) {
        if (
          !messageIds.has(message.id) &&
          message.conversation_id !== activeConversationId
        ) {
          counts[message.conversation_id] =
            (counts[message.conversation_id] || 0) + 1
        }
      }

      setUnreadCounts(counts)
      initialLoadComplete = true
    }

    loadUnreadMessages()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [userId, conversations, activeConversationId])

  // Opening a conversation marks it as read.
  useEffect(() => {
    if (!userId || !activeConversationId) return

    const timestamps = readTimestamps(userId)
    timestamps[activeConversationId] = new Date().toISOString()
    saveTimestamps(userId, timestamps)

    setUnreadCounts((previous) => {
      const next = { ...previous }
      delete next[activeConversationId]
      return next
    })
  }, [userId, activeConversationId])

  return { unreadCounts }
}

function readTimestampsForUser(userId: string): ReadTimestamps {
  return readTimestamps(userId)
}