type AddFriendModalProps = {
  open: boolean
  onClose: () => void
  username: string
  setUsername: (value: string) => void
  error: string
  success: string
  adding: boolean
  onSubmit: () => void
}

export default function AddFriendModal({
  open,
  onClose,
  username,
  setUsername,
  error,
  success,
  adding,
  onSubmit,
}: AddFriendModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#34353d] bg-[#1e1f24] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Add Friend</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-400">
          Enter their exact NEXUS username.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <input
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="username"
            maxLength={24}
            className="mt-4 w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
          />

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          {success && (
            <p className="mt-3 text-sm text-green-400">{success}</p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#34353d] px-4 py-2 text-sm hover:bg-[#454650]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-[#0390fc] px-4 py-2 text-sm font-semibold hover:bg-[#0390fc] disabled:opacity-50"
            >
              {adding ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
