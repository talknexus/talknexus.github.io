import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import type {
  ConversationEntry,
  DmMessage,
  SettingsProfile,
} from '../types'
import type { MessageReaction } from '../hooks/useMessageReactions'
import type { FormEvent, Dispatch, SetStateAction } from 'react'

type ChatsPageProps = {
  activeConversationId: string | null
  userId: string
  profile: SettingsProfile | null
  activeConversation: ConversationEntry | undefined
  pageError: string
  loadingMessages: boolean
  messages: DmMessage[]
  reactions: MessageReaction[]
  onToggleReaction: (messageId: string, emoji: string) => Promise<boolean>
  onEditMessage: (messageId: string, content: string) => Promise<boolean>
  onDeleteMessage: (messageId: string) => Promise<boolean>
  messageText: string
  setMessageText: Dispatch<SetStateAction<string>>
  selectedFile: File | null
  setSelectedFile: Dispatch<SetStateAction<File | null>>
  sendingMessage: boolean
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void
  replyingTo: DmMessage | null
  onReply: (message: DmMessage) => void
  onCancelReply: () => void
}

export default function ChatsPage({
  userId,
  profile,
  activeConversation,
  pageError,
  loadingMessages,
  messages,
  reactions,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  messageText,
  setMessageText,
  selectedFile,
  setSelectedFile,
  sendingMessage,
  onSendMessage,
  replyingTo,
  onReply,
  onCancelReply,
}: ChatsPageProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const messageContentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const highlightTimeoutRef = useRef<number | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)

  useEffect(() => {
    isAtBottomRef.current = true
  }, [activeConversation?.conversation.id])

  useEffect(() => {
    const container = messageListRef.current

    if (container && isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, loadingMessages, activeConversation?.conversation.id])

  useEffect(() => {
    const container = messageListRef.current
    const content = messageContentRef.current

    if (!container || !content) return

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        container.scrollTop = container.scrollHeight
      }
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [activeConversation?.conversation.id])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  const jumpToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`)

    if (!element) return

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })

    setHighlightedMessageId(messageId)

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null)
      highlightTimeoutRef.current = null
    }, 1800)
  }, [])

  const replyingSender = replyingTo
    ? replyingTo.sender_id === userId
      ? profile
      : activeConversation?.profile ?? null
    : null

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#34353d] px-5">
              <Avatar person={activeConversation.profile} size="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {activeConversation.profile.display_name}
                </p>
                <p className="truncate text-xs text-gray-400">
                  @{activeConversation.profile.username}
                </p>
              </div>
            </header>

            {pageError && (
              <p className="m-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                {pageError}
              </p>
            )}

            <div
              ref={messageListRef}
              onScroll={(event) => {
                const container = event.currentTarget
                const distanceFromBottom =
                  container.scrollHeight -
                  container.scrollTop -
                  container.clientHeight

                isAtBottomRef.current = distanceFromBottom < 120
              }}
              className="min-h-0 flex-1 overflow-y-auto p-5 [overflow-anchor:none]"
            >
              <div ref={messageContentRef} className="min-h-full">
                {loadingMessages ? (
                  <p className="text-center text-sm text-gray-400">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Avatar person={activeConversation.profile} size="h-16 w-16" />
                    <h3 className="mt-4 text-xl font-bold">
                      {activeConversation.profile.display_name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      This is the beginning of your conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const previousMessage = messages[index - 1]
                    const sameSender =
                      previousMessage?.sender_id === message.sender_id
                    const withinFiveMinutes =
                      previousMessage &&
                      new Date(message.created_at).getTime() -
                        new Date(previousMessage.created_at).getTime() <=
                        5 * 60 * 1000

                    const showHeader = !sameSender || !withinFiveMinutes
                    const replyToMessage = message.reply_to_message_id
                      ? messages.find(
                          (item) => item.id === message.reply_to_message_id,
                        ) ?? null
                      : null

                    const replySender = replyToMessage
                      ? replyToMessage.sender_id === userId && profile
                        ? profile
                        : activeConversation.profile
                      : null

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        sender={
                          message.sender_id === userId && profile
                            ? profile
                            : activeConversation.profile
                        }
                        showHeader={showHeader}
                        reactions={reactions.filter(
                          (reaction) => reaction.message_id === message.id,
                        )}
                        userId={userId}
                        onToggleReaction={onToggleReaction}
                        onEditMessage={onEditMessage}
                        onDeleteMessage={onDeleteMessage}
                        onReply={onReply}
                        replyToMessage={replyToMessage}
                        replySender={replySender}
                        onJumpToMessage={jumpToMessage}
                        isHighlighted={highlightedMessageId === message.id}
                      />
                    )
                  })
                )}
              </div>
            </div>

            <MessageComposer
              messageText={messageText}
              setMessageText={setMessageText}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              sendingMessage={sendingMessage}
              recipientName={activeConversation.profile.display_name}
              replyingTo={replyingTo}
              replySender={replyingSender}
              onCancelReply={onCancelReply}
              onSubmit={onSendMessage}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#34353d] text-4xl">
              💬
            </div>
            <h2 className="text-2xl font-bold">Your messages</h2>
            <p className="mt-2 max-w-md text-sm text-gray-400">
              Select a conversation to start chatting, or message a friend
              from your Friends list.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}