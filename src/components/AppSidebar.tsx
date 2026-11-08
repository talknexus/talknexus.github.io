import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import ConversationList from './ConversationList'
import type { ConversationEntry, SettingsProfile } from '../types'

type AppSidebarProps = {
  activePage: 'friends' | 'chats'
  onNavigate: (page: 'friends' | 'chats') => void
  incomingCount: number
  conversations: ConversationEntry[]
  unreadCounts: Record<string, number>
  loadingConversations: boolean
  activeConversationId: string | null
  userId: string
  onSelectConversation: (id: string) => void
  profile: SettingsProfile | null
}

export default function AppSidebar({
  activePage,
  onNavigate,
  incomingCount,
  conversations,
  unreadCounts,
  loadingConversations,
  activeConversationId,
  userId,
  onSelectConversation,
  profile,
}: AppSidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#292a30] bg-[#1e1f24]">
      <div className="flex h-14 items-center border-b border-[#292a30] px-4">
        <h1 className="text-lg font-bold tracking-wide">NEXUS</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          Menus
        </p>

        <button
          onClick={() => onNavigate('friends')}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
            activePage === 'friends'
              ? 'bg-[#34353d] text-white'
              : 'text-gray-400 hover:bg-[#292a30] hover:text-white'
          }`}
        >
          👥 Friends
          {incomingCount > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
              {incomingCount}
            </span>
          )}
        </button>

        <p className="mb-2 mt-7 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          Direct Messages
        </p>

        <ConversationList
          conversations={conversations}
          unreadCounts={unreadCounts}
          loading={loadingConversations}
          activeConversationId={activeConversationId}
          userId={userId}
          variant="sidebar"
          onSelect={onSelectConversation}
        />
      </div>

      <div className="border-t border-[#292a30] p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#292a30] p-2">
          {profile && <Avatar person={profile} size="h-10 w-10" />}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {profile?.display_name || 'Loading...'}
            </p>
            <p className="truncate text-xs text-gray-400">
              {profile ? `@${profile.username}` : ''}
            </p>
          </div>

          <Link
            to="/app/settings"
            title="User Settings"
            className="rounded-md p-2 text-gray-400 transition hover:bg-[#41424a] hover:text-white"
          >
            ⚙️
          </Link>
        </div>
      </div>
    </aside>
  )
}