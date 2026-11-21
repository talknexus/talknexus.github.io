import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'

export type InviteFriend = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

type InviteMembersModalProps = {
  open: boolean
  full: boolean
  friends: InviteFriend[]
  onClose: () => void
  onAdd: (friendId: string) => Promise<boolean>
}

export default function InviteMembersModal({
  open,
  full,
  friends,
  onClose,
  onAdd,
}: InviteMembersModalProps) {
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setAddedIds([])
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function closeModal() {
    setAddedIds([])
    onClose()
  }

  async function addFriend(friendId: string) {
    setAddingId(friendId)
    const added = await onAdd(friendId)
    setAddingId(null)
    if (added) {
      setAddedIds((current) =>
        current.includes(friendId) ? current : [...current, friendId],
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-members-title"
        className="flex max-h-[calc(100vh-32px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#34353d] bg-[#1e1f24] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#34353d] px-5 py-4">
          <h2 id="invite-members-title" className="font-bold">
            {full ? 'Group full' : 'Invite Friends'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeModal}
            className="rounded-md px-2 py-1 text-xl text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {full ? (
          <div className="p-6 text-center">
            <p className="text-sm leading-relaxed text-gray-300">
              Hey, the room is too full here, try getting some people out, or make a new group chat!
            </p>
            <button
              type="button"
              onClick={closeModal}
              className="mt-5 w-full rounded-lg bg-[#0390fc] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#168ff0]"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {friends.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-gray-400">
                No eligible friends to invite.
              </p>
            ) : (
              friends.map((friend) => {
                const added = addedIds.includes(friend.id)
                return (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 rounded-lg p-3"
                  >
                    <Avatar person={friend} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {friend.display_name}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        @{friend.username}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={added || addingId === friend.id}
                      onClick={() => addFriend(friend.id)}
                      className={`min-w-20 rounded-lg px-3 py-2 text-sm font-bold transition ${
                        added
                          ? 'border border-[#0390fc]/30 bg-[#0390fc]/10 text-[#0390fc]'
                          : 'bg-[#0390fc] text-white hover:bg-[#168ff0]'
                      } disabled:cursor-default`}
                    >
                      {added
                        ? 'Added'
                        : addingId === friend.id
                          ? 'Adding...'
                          : 'Add'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
