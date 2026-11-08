import Avatar from './Avatar'
import type { ConversationEntry } from '../types'

type ConversationListProps = {
  conversations: ConversationEntry[]
  loading: boolean
  activeConversationId: string | null
  userId: string
  variant: 'sidebar' | 'panel'
  onSelect: (conversationId: string) => void
  unreadCounts?: Record<string, number>
}

export default function ConversationList({
  conversations,
  loading,
  activeConversationId,
  userId,
  variant,
  onSelect,
  unreadCounts = {},
}: ConversationListProps) {
  if (variant === 'sidebar') {
    return (
      <>
        {loading ? (
          <p className="px-2 text-xs text-gray-500">Loading chats...</p>
        ) : conversations.length === 0 ? (
          <p className="px-2 text-xs text-gray-500">
            No conversations yet.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((entry) => (
              <button
                key={entry.conversation.id}
                onClick={() => onSelect(entry.conversation.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition ${
                  activeConversationId === entry.conversation.id
                    ? 'bg-[#34353d] text-white'
                    : 'text-gray-400 hover:bg-[#292a30] hover:text-white'
                }`}
              >
                <Avatar person={entry.profile} size="h-8 w-8" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {entry.profile.display_name}
                </span>
                {(unreadCounts[entry.conversation.id] || 0) > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {unreadCounts[entry.conversation.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <section className="flex w-72 shrink-0 flex-col border-r border-[#34353d]">
      <header className="flex h-14 shrink-0 items-center border-b border-[#34353d] px-4">
        <h2 className="font-semibold">Direct Messages</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="p-3 text-sm text-gray-400">
            Loading conversations...
          </p>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-gray-400">
              No conversations yet.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Accept a friend request to start chatting.
            </p>
          </div>
        ) : (
          conversations.map((entry) => (
            <button
              key={entry.conversation.id}
              onClick={() => onSelect(entry.conversation.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg p-3 text-left transition ${
                activeConversationId === entry.conversation.id
                  ? 'bg-[#34353d]'
                  : 'hover:bg-[#292a30]'
              }`}
            >
              <Avatar person={entry.profile} size="h-11 w-11" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {entry.profile.display_name}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {entry.lastMessage
                    ? `${entry.lastMessage.sender_id === userId ? 'You: ' : ''}${entry.lastMessage.content}`
                    : 'Start a conversation'}
                </p>
              </div>
              {(unreadCounts[entry.conversation.id] || 0) > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCounts[entry.conversation.id]}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  )
}