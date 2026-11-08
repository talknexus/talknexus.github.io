import Avatar from './Avatar'
import FriendRow from './FriendRow'
import type { FriendEntry } from '../types'

type FriendsPageProps = {
  activeFriendTab: 'all' | 'pending'
  setActiveFriendTab: (tab: 'all' | 'pending') => void
  friends: FriendEntry[]
  incomingRequests: FriendEntry[]
  outgoingRequests: FriendEntry[]
  loadingFriends: boolean
  pageError: string
  requestLoading: string | null
  onOpenAddFriend: () => void
  onOpenConversation: (person: FriendEntry['profile']) => void
  onUnfriend: (id: string, name: string) => void
  onRespondToRequest: (id: string, accept: boolean) => void
}

export default function FriendsPage({
  activeFriendTab,
  setActiveFriendTab,
  friends,
  incomingRequests,
  outgoingRequests,
  loadingFriends,
  pageError,
  requestLoading,
  onOpenAddFriend,
  onOpenConversation,
  onUnfriend,
  onRespondToRequest,
}: FriendsPageProps) {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#34353d] px-6">
        <div className="flex items-center gap-5">
          <h2 className="font-semibold">Friends</h2>

          <button
            onClick={() => setActiveFriendTab('all')}
            className={`text-sm ${
              activeFriendTab === 'all'
                ? 'text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>

          <button
            onClick={() => setActiveFriendTab('pending')}
            className={`text-sm ${
              activeFriendTab === 'pending'
                ? 'text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Pending
            {incomingRequests.length > 0 && (
              <span className="ml-1 text-red-400">
                ({incomingRequests.length})
              </span>
            )}
          </button>
        </div>

        <button
          onClick={onOpenAddFriend}
          className="rounded-lg bg-[#0390fc] px-4 py-2 text-sm font-semibold hover:bg-[#0390fc]"
        >
          Add Friend
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-6">
        {pageError && (
          <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
            {pageError}
          </p>
        )}

        {loadingFriends ? (
          <p className="text-sm text-gray-400">Loading friends...</p>
        ) : activeFriendTab === 'all' ? (
          <>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              All Friends · {friends.length}
            </h3>

            {friends.length > 0 ? (
              <div className="space-y-1">
                {friends.map((entry) => (
                  <FriendRow
                    key={entry.friendship.id}
                    entry={entry}
                    requestLoading={requestLoading}
                    onOpenConversation={onOpenConversation}
                    onUnfriend={onUnfriend}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 text-5xl">👋</div>
                <h3 className="text-xl font-bold">No friends yet</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Add someone using their exact NEXUS username.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              Incoming Requests · {incomingRequests.length}
            </h3>

            {incomingRequests.length === 0 && (
              <p className="mb-6 text-sm text-gray-400">
                No incoming friend requests.
              </p>
            )}

            <div className="space-y-2">
              {incomingRequests.map(({ friendship, profile: person }) => (
                <div
                  key={friendship.id}
                  className="flex items-center gap-3 rounded-lg bg-[#1e1f24] p-3"
                >
                  <Avatar person={person} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {person.display_name}
                    </p>
                    <p className="truncate text-sm text-gray-400">
                      @{person.username}
                    </p>
                  </div>

                  <button
                    disabled={requestLoading === friendship.id}
                    onClick={() => onRespondToRequest(friendship.id, true)}
                    className="rounded-lg bg-[#0390fc] px-3 py-2 text-sm font-semibold hover:bg-[#0390fc] disabled:opacity-50"
                  >
                    Accept
                  </button>

                  <button
                    disabled={requestLoading === friendship.id}
                    onClick={() => onRespondToRequest(friendship.id, false)}
                    className="rounded-lg bg-[#34353d] px-3 py-2 text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-gray-400">
              Outgoing Requests · {outgoingRequests.length}
            </h3>

            {outgoingRequests.length === 0 ? (
              <p className="text-sm text-gray-400">
                No outgoing requests.
              </p>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.map(({ friendship, profile: person }) => (
                  <div
                    key={friendship.id}
                    className="flex items-center gap-3 rounded-lg bg-[#1e1f24] p-3"
                  >
                    <Avatar person={person} />

                    <div className="flex-1">
                      <p className="font-semibold">{person.display_name}</p>
                      <p className="text-sm text-gray-400">
                        @{person.username}
                      </p>
                    </div>

                    <span className="text-sm text-gray-400">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
