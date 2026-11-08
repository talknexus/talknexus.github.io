import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DmMessage } from '../types'

type UseMessagesProps = {
  userId: string
  activeConversationId: string | null
  setPageError: (error: string) => void
  loadConversations: (currentUserId: string) => Promise<void>
}

function mergeMessages(
  current: DmMessage[],
  incoming: DmMessage[],
): DmMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))

  for (const message of incoming) {
    byId.set(message.id, message)
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime(),
  )
}

function sanitizeFilename(filename: string) {
  return filename
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ()]/g, '_')
    .slice(0, 150) || 'attachment'
}

export default function useMessages({
  userId,
  activeConversationId,
  setPageError,
  loadConversations,
}: UseMessagesProps) {
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      setLoadingMessages(false)
      return
    }

    let cancelled = false

    setMessages([])
    setLoadingMessages(true)

    const channel = supabase
      .channel(`dm-messages-${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const incoming = payload.new as DmMessage
          setMessages((current) => mergeMessages(current, [incoming]))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const updated = payload.new as DmMessage
          setMessages((current) => mergeMessages(current, [updated]))
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'dm_messages',
        },
        (payload) => {
          const deleted = payload.old as Partial<DmMessage>

          if (!deleted.id) return

          setMessages((current) =>
            current.filter((message) => message.id !== deleted.id),
          )
        },
      )
      .subscribe()

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('dm_messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (error) {
        setPageError(error.message)
      } else {
        setMessages((current) =>
          mergeMessages(current, (data || []) as DmMessage[]),
        )
      }

      setLoadingMessages(false)
    }

    fetchMessages()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeConversationId, setPageError])

  const sendMessage = useCallback(async (
    content: string,
    file: File | null = null,
    replyToMessageId: string | null = null,
  ) => {
    if (
      (!content.trim() && !file) ||
      !activeConversationId ||
      !userId ||
      sendingMessage
    ) {
      return false
    }

    if (file && file.size > 25 * 1024 * 1024) {
      setPageError('Files must be 25 MB or smaller.')
      return false
    }

    setSendingMessage(true)
    setPageError('')

    let uploadedPath: string | null = null

    try {
      let attachment = {
        attachment_name: null as string | null,
        attachment_path: null as string | null,
        attachment_mime_type: null as string | null,
        attachment_size: null as number | null,
      }

      if (file) {
        const filename = sanitizeFilename(file.name)
        const path = `${activeConversationId}/${userId}/${crypto.randomUUID()}-${filename}`

        const { error: uploadError } = await supabase.storage
          .from('dm-attachments')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          })

        if (uploadError) {
          setPageError(uploadError.message)
          return false
        }

        uploadedPath = path

        attachment = {
          attachment_name: file.name,
          attachment_path: path,
          attachment_mime_type: file.type || 'application/octet-stream',
          attachment_size: file.size,
        }
      }

      const { data, error } = await supabase
        .from('dm_messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: userId,
          content: content.trim(),
          reply_to_message_id: replyToMessageId,
          ...attachment,
        })
        .select()
        .single()

      if (error) {
        if (uploadedPath) {
          await supabase.storage
            .from('dm-attachments')
            .remove([uploadedPath])
        }

        setPageError(error.message)
        return false
      }

      if (data) {
        setMessages((current) =>
          mergeMessages(current, [data as DmMessage]),
        )
      }

      await loadConversations(userId)
      return true
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage
          .from('dm-attachments')
          .remove([uploadedPath])
      }

      setPageError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while sending your message.',
      )
      return false
    } finally {
      setSendingMessage(false)
    }
  }, [
    activeConversationId,
    userId,
    sendingMessage,
    setPageError,
    loadConversations,
  ])

  const editMessage = useCallback(async (
    messageId: string,
    content: string,
  ) => {
    const trimmedContent = content.trim()

    const message = messages.find((item) => item.id === messageId)

    if (!message || message.sender_id !== userId) {
      setPageError('You can only edit your own messages.')
      return false
    }

    if (!trimmedContent && !message.attachment_path) {
      setPageError('A message cannot be empty.')
      return false
    }

    setPageError('')

    try {
      const { data, error } = await supabase
        .from('dm_messages')
        .update({
          content: trimmedContent,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', userId)
        .select()
        .single()

      if (error) {
        setPageError(error.message)
        return false
      }

      setMessages((current) =>
        mergeMessages(current, [data as DmMessage]),
      )

      if (activeConversationId) {
        await loadConversations(userId)
      }

      return true
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while editing your message.',
      )
      return false
    }
  }, [
    messages,
    userId,
    activeConversationId,
    setPageError,
    loadConversations,
  ])

  const deleteMessage = useCallback(async (messageId: string) => {
    const message = messages.find((item) => item.id === messageId)

    if (!message || message.sender_id !== userId) {
      setPageError('You can only delete your own messages.')
      return false
    }

    setPageError('')

    try {
      const { error } = await supabase
        .from('dm_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId)

      if (error) {
        setPageError(error.message)
        return false
      }

      setMessages((current) =>
        current.filter((item) => item.id !== messageId),
      )

      if (message.attachment_path) {
        const { error: storageError } = await supabase.storage
          .from('dm-attachments')
          .remove([message.attachment_path])

        if (storageError) {
          setPageError(
            'Message deleted, but its attachment could not be removed: ' +
            storageError.message,
          )
        }
      }

      if (activeConversationId) {
        await loadConversations(userId)
      }

      return true
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while deleting your message.',
      )
      return false
    }
  }, [
    messages,
    userId,
    activeConversationId,
    setPageError,
    loadConversations,
  ])

  return {
    messages,
    loadingMessages,
    sendingMessage,
    sendMessage,
    editMessage,
    deleteMessage,
  }
}