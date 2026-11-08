import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export type MessageReaction = {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

type UseMessageReactionsOptions = {
  conversationId: string | null
  messageIds: string[]
  userId: string
}

export default function useMessageReactions({
  conversationId,
  messageIds,
  userId,
}: UseMessageReactionsOptions) {
  const [reactions, setReactions] = useState<MessageReaction[]>([])
  const [loadingReactions, setLoadingReactions] = useState(false)
  const [reactionError, setReactionError] = useState('')

  const messageIdsKey = messageIds.join(',')
  const messageIdsRef = useRef(messageIds)

  useEffect(() => {
    messageIdsRef.current = messageIds
  }, [messageIdsKey])

  const loadReactions = useCallback(async () => {
    if (!conversationId || messageIdsRef.current.length === 0) {
      setReactions([])
      setLoadingReactions(false)
      return
    }

    setLoadingReactions(true)

    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIdsRef.current)

    if (error) {
      setReactionError(error.message)
    } else {
      setReactionError('')
      setReactions(data ?? [])
    }

    setLoadingReactions(false)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setReactions([])
      return
    }

    void loadReactions()

    const channel = supabase
      .channel(`message-reactions-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          void loadReactions()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, loadReactions])

  useEffect(() => {
    if (conversationId) {
      void loadReactions()
    }
  }, [messageIdsKey, conversationId, loadReactions])

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return false

      setReactionError('')

      const existingReaction = reactions.find(
        (reaction) =>
          reaction.message_id === messageId &&
          reaction.user_id === userId &&
          reaction.emoji === emoji,
      )

      if (existingReaction) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id)

        if (error) {
          setReactionError(error.message)
          return false
        }

        setReactions((current) =>
          current.filter((reaction) => reaction.id !== existingReaction.id),
        )

        return true
      }

      const temporaryId = `temp-${crypto.randomUUID()}`
      const optimisticReaction: MessageReaction = {
        id: temporaryId,
        message_id: messageId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString(),
      }

      setReactions((current) => [...current, optimisticReaction])

      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        })
        .select()
        .single()

      if (error) {
        console.error('Reaction insert failed:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })

        setReactions((current) =>
          current.filter((reaction) => reaction.id !== temporaryId),
        )
        setReactionError(error.message)
        return false
      }

      setReactions((current) =>
        current.map((reaction) =>
          reaction.id === temporaryId ? data : reaction,
        ),
      )

      return true
    },
    [reactions, userId],
  )

  return {
    reactions,
    loadingReactions,
    reactionError,
    toggleReaction,
  }
}
