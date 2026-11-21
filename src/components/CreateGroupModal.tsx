import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'
import type { FriendEntry } from '../types'

type CreateGroupModalProps = {
  open: boolean
  friends: FriendEntry[]
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export default function CreateGroupModal({
  open,
  friends,
  onClose,
  onCreated,
}: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setSelectedIds([])
    setError('')
    closeRef.current?.focus()
  }, [open])

  if (!open) return null

  function toggleMember(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((memberId) => memberId !== id)
      }
      if (current.length >= 9) {
        setError('A group can have 10 members including you.')
        return current
      }
      setError('')
      return [...current, id]
    })
  }

  async function createGroup() {
    const cleanName = name.trim()
    if (cleanName.length < 1 || cleanName.length > 80) {
      setError('Enter a group name between 1 and 80 characters.')
      return
    }
    if (selectedIds.length < 1) {
      setError('Select at least one friend.')
      return
    }

    setCreating(true)
    setError('')

    const { data, error: createError } = await supabase.rpc('create_group', {
      p_name: cleanName,
      p_member_ids: selectedIds,
    })

    setCreating(false)

    if (createError) {
      setError(createError.message)
      return
    }

    if (typeof data === 'string') {
      onCreated(data)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        className="flex max-h-[calc(100vh-32px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[#34353d] bg-[#1e1f24] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#34353d] px-5 py-4">
          <h2 id="create-group-title" className="font-bold">Create Group</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xl text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <label className="text-sm font-bold">Group Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
            placeholder="Enter a group name"
            className="mt-2 w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
          />

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-bold">Members</p>
            <p className="text-xs text-gray-500">
              {selectedIds.length + 1}/10
            </p>
          </div>

          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {friends.map((entry) => {
              const selected = selectedIds.includes(entry.profile.id)
              return (
                <button
                  key={entry.friendship.id}
                  type="button"
                  onClick={() => toggleMember(entry.profile.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                    selected
                      ? 'bg-[#0390fc]/15 ring-1 ring-[#0390fc]/50'
                      : 'hover:bg-[#292a30]'
                  }`}
                >
                  <Avatar person={entry.profile} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {entry.profile.display_name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      @{entry.profile.username}
                    </p>
                  </div>
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                    selected
                      ? 'border-[#0390fc] bg-[#0390fc] text-white'
                      : 'border-[#555760]'
                  }`}>
                    {selected ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-[#34353d] p-4">
          <button
            type="button"
            onClick={createGroup}
            disabled={creating}
            className="w-full rounded-lg bg-[#0390fc] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#168ff0] disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
