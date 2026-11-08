
import { useState } from 'react'
import Avatar from './Avatar'
import MessageAttachment from './MessageAttachment'
import type { Profile, SettingsProfile, DmMessage } from '../types'
import type { MessageReaction } from '../hooks/useMessageReactions'

type MessageBubbleProps = {
  message: DmMessage
  sender: Profile | SettingsProfile
  showHeader: boolean
  reactions: MessageReaction[]
  userId: string
  onToggleReaction: (messageId: string, emoji: string) => Promise<boolean>
  onEditMessage: (messageId: string, content: string) => Promise<boolean>
  onDeleteMessage: (messageId: string) => Promise<boolean>
  onReply: (message: DmMessage) => void
  replyToMessage: DmMessage | null
  replySender: Profile | SettingsProfile | null
  onJumpToMessage: (messageId: string) => void
  isHighlighted: boolean
}

const quickEmojis = ['👍', '❤️', '😂', '😮']
const reactionEmojis = [
  '👍', '❤️', '😂', '😮', '😢', '🔥',
  '🎉', '👏', '💀', '👀', '🤔', '🙏',
  '🥳', '😭', '💯', '❤️‍🔥', '🤝', '✨',
]

function formatMessageDate(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const messageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )

  const time = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (messageDay.getTime() === today.getTime()) {
    return `Today at ${time}`
  }

  if (messageDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${time}`
  }

  const fullDate = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${fullDate} at ${time}`
}

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getReplyExcerpt(message: DmMessage) {
  if (message.content) return message.content
  if (message.attachment_name) return `Attachment: ${message.attachment_name}`
  return 'Message'
}

function ReplyPreview({
  message,
  replyToMessage,
  replySender,
  onJumpToMessage,
}: {
  message: DmMessage
  replyToMessage: DmMessage | null
  replySender: Profile | SettingsProfile | null
  onJumpToMessage: (messageId: string) => void
}) {
  if (!message.reply_to_message_id) return null

  if (!replyToMessage || !replySender) {
    return (
      <div className="mb-2 flex items-center gap-2 pl-1 text-xs text-gray-500">
        <span className="h-4 w-0.5 rounded-full bg-gray-600" />
        Original message is unavailable
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onJumpToMessage(replyToMessage.id)}
      className="mb-2 flex max-w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.06]"
      title="Jump to original message"
    >
      <span className="h-7 w-0.5 shrink-0 rounded-full bg-gray-500" />
      <Avatar person={replySender} size="h-5 w-5" />
      <span className="shrink-0 text-xs font-semibold text-gray-300">
        {replySender.display_name}
      </span>
      <span className="truncate text-xs text-gray-400">
        {getReplyExcerpt(replyToMessage)}
      </span>
    </button>
  )
}

function ReactionBar({
  messageId,
  reactions,
  userId,
  onToggleReaction,
  onReply,
  message,
  isOwnMessage,
  onStartEditing,
  onDeleteMessage,
}: {
  messageId: string
  reactions: MessageReaction[]
  userId: string
  onToggleReaction: (messageId: string, emoji: string) => Promise<boolean>
  onReply: (message: DmMessage) => void
  message: DmMessage
  isOwnMessage: boolean
  onStartEditing: () => void
  onDeleteMessage: (messageId: string) => Promise<boolean>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const groupedReactions = reactions.reduce<
    { emoji: string; count: number; mine: boolean }[]
  >((groups, reaction) => {
    const existing = groups.find((group) => group.emoji === reaction.emoji)

    if (existing) {
      existing.count += 1
      if (reaction.user_id === userId) existing.mine = true
    } else {
      groups.push({
        emoji: reaction.emoji,
        count: 1,
        mine: reaction.user_id === userId,
      })
    }

    return groups
  }, [])

  async function chooseEmoji(emoji: string) {
    await onToggleReaction(messageId, emoji)
    setPickerOpen(false)
  }

  function deleteMessage() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this message? This cannot be undone.',
    )

    if (confirmed) {
      void onDeleteMessage(messageId)
    }
  }

  return (
    <>
      {groupedReactions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {groupedReactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              onClick={() => void chooseEmoji(reaction.emoji)}
              aria-label={`${reaction.emoji}, ${reaction.count} reactions`}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors ${
                reaction.mine
                  ? 'border-[#0390fc]/70 bg-[#0390fc]/20 text-[#0390fc]'
                  : 'border-[#454650] bg-[#303139] text-gray-300 hover:border-gray-500 hover:bg-[#393a44]'
              }`}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute right-2 top-0 z-30 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-[#454650] bg-[#303139] p-1 opacity-0 shadow-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onReply(message)}
          title="Reply"
          aria-label="Reply to message"
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          ↩
        </button>

        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => void chooseEmoji(emoji)}
            title={`React with ${emoji}`}
            aria-label={`React with ${emoji}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="More reactions"
            aria-expanded={pickerOpen}
            title="More reactions"
            className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            ☺
          </button>

          {pickerOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 grid w-52 grid-cols-6 gap-1 rounded-lg border border-[#454650] bg-[#303139] p-2 shadow-xl">
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void chooseEmoji(emoji)}
                  aria-label={`React with ${emoji}`}
                  className="flex h-8 w-7 items-center justify-center rounded hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {isOwnMessage && (
          <>
            <button
              type="button"
              onClick={onStartEditing}
              title="Edit message"
              aria-label="Edit message"
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              ✎
            </button>

            <button
              type="button"
              onClick={deleteMessage}
              title="Delete message"
              aria-label="Delete message"
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-gray-300 transition-colors hover:bg-red-500/20 hover:text-red-400"
            >
              ⌫
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default function MessageBubble({
  message,
  sender,
  showHeader,
  reactions,
  userId,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onReply,
  replyToMessage,
  replySender,
  onJumpToMessage,
  isHighlighted,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [savingEdit, setSavingEdit] = useState(false)

  const isOwnMessage = message.sender_id === userId

  const editedAt = (
    message as DmMessage & { edited_at?: string | null }
  ).edited_at

  const highlightClass = isHighlighted
    ? 'bg-[#0390fc]/20 ring-1 ring-[#0390fc]/60'
    : 'hover:bg-white/[0.02]'

  function startEditing() {
    setDraft(message.content)
    setEditing(true)
  }

  function cancelEditing() {
    setDraft(message.content)
    setEditing(false)
  }

  async function saveEdit() {
    if (savingEdit) return

    setSavingEdit(true)

    try {
      const saved = await onEditMessage(message.id, draft)

      if (saved) {
        setEditing(false)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const replyPreview = (
    <ReplyPreview
      message={message}
      replyToMessage={replyToMessage}
      replySender={replySender}
      onJumpToMessage={onJumpToMessage}
    />
  )

  const messageContent = editing ? (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void saveEdit()
      }}
      className="mt-1 space-y-2"
    >
      <textarea
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={Math.min(Math.max(draft.split('\n').length, 2), 8)}
        disabled={savingEdit}
        aria-label="Edit message"
        className="w-full resize-y rounded-md border border-[#0390fc]/50 bg-[#1d1e23] px-3 py-2 text-sm leading-relaxed text-white outline-none focus:border-[#0390fc] disabled:opacity-60"
      />

      <div className="flex items-center gap-2 text-xs">
        <button
          type="submit"
          disabled={savingEdit || (!draft.trim() && !message.attachment_path)}
          className="rounded-md bg-[#0390fc] px-3 py-1.5 font-medium text-white transition-colors hover:bg-[#0390fc] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingEdit ? 'Saving...' : 'Save'}
        </button>

        <button
          type="button"
          onClick={cancelEditing}
          disabled={savingEdit}
          className="rounded-md px-3 py-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>

        <span className="text-gray-500">
          escape to cancel
        </span>
      </div>
    </form>
  ) : (
    <>
      {message.content && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#dbdee1]">
          {message.content}
        </p>
      )}
    </>
  )

  const reactionBar = !editing ? (
    <ReactionBar
      messageId={message.id}
      reactions={reactions}
      userId={userId}
      onToggleReaction={onToggleReaction}
      onReply={onReply}
      message={message}
      isOwnMessage={isOwnMessage}
      onStartEditing={startEditing}
      onDeleteMessage={onDeleteMessage}
    />
  ) : null

  if (!showHeader) {
    return (
      <div
        id={`message-${message.id}`}
        className={`group relative flex scroll-mt-24 items-start gap-3 rounded-md px-2 py-0 transition-colors duration-500 ${highlightClass}`}
      >
        <div className="flex h-6 w-10 shrink-0 items-center justify-end">
          <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100">
            {formatMessageTime(message.created_at)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {replyPreview}
          {messageContent}
          {editedAt && (
            <span className="ml-1 text-[10px] text-gray-500">
              (edited)
            </span>
          )}
          <MessageAttachment message={message} />
        </div>

        {reactionBar}
      </div>
    )
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`group relative mt-3 scroll-mt-24 rounded-md px-2 py-1 transition-colors duration-500 ${highlightClass}`}
    >
      {replyPreview}

      <div className="flex items-start gap-3">
        <Avatar person={sender} size="h-10 w-10" />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-white">
              {sender.display_name}
            </span>

            <span className="text-[11px] text-gray-500">
              {formatMessageDate(message.created_at)}
            </span>

            {editedAt && (
              <span className="text-[10px] text-gray-500">
                (edited)
              </span>
            )}
          </div>

          {messageContent}
          <MessageAttachment message={message} />
        </div>
      </div>

      {reactionBar}
    </div>
  )
}
