import Avatar from './Avatar'
import type { FriendEntry, Profile } from '../types'

type FriendRowProps = {
  entry: FriendEntry
  requestLoading: string | null
  onOpenConversation: (person: Profile) => void
  onUnfriend: (friendshipId: string, displayName: string) => void
}

export default function FriendRow({
  entry,
  requestLoading,
  onOpenConversation,
  onUnfriend,
}: FriendRowProps) {
  const { friendship, profile: person } = entry

  return (
    <div className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-[#292a30]">
      <Avatar person={person} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{person.display_name}</p>
        <p className="truncate text-sm text-gray-400">@{person.username}</p>
      </div>

      <button
        title="Message"
        className="rounded-lg bg-[#34353d] px-3 py-2 text-sm hover:bg-indigo-600"
        onClick={() => onOpenConversation(person)}
      >
        💬
      </button>

      <details className="relative">
        <summary className="cursor-pointer list-none rounded-lg bg-[#34353d] px-3 py-2 text-sm hover:bg-[#454650]">
          ⋯
        </summary>

        <div className="absolute right-0 top-full z-20 mt-2 w-36 rounded-lg border border-[#34353d] bg-[#1e1f24] p-1 shadow-xl">
          <button
            disabled={requestLoading === friendship.id}
            onClick={() => onUnfriend(friendship.id, person.display_name)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Unfriend
          </button>
        </div>
      </details>
    </div>
  )
}