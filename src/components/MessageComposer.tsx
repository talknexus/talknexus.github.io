import { useRef } from 'react'
import type { FormEvent, Dispatch, SetStateAction } from 'react'
import Avatar from './Avatar'
import type { DmMessage, Profile, SettingsProfile } from '../types'

type MessageComposerProps = {
  messageText: string
  setMessageText: Dispatch<SetStateAction<string>>
  selectedFile: File | null
  setSelectedFile: Dispatch<SetStateAction<File | null>>
  sendingMessage: boolean
  recipientName: string
  replyingTo: DmMessage | null
  replySender: Profile | SettingsProfile | null
  onCancelReply: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessageComposer({
  messageText,
  setMessageText,
  selectedFile,
  setSelectedFile,
  sendingMessage,
  recipientName,
  replyingTo,
  replySender,
  onCancelReply,
  onSubmit,
}: MessageComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(file: File | undefined) {
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('Files must be 10 MB or smaller.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <form
      onSubmit={onSubmit}
      className="shrink-0 border-t border-[#34353d] p-4"
    >
      {replyingTo && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#41434c] bg-[#202127] p-3">
          <div className="h-8 w-1 shrink-0 rounded-full bg-[#0390fc]" />

          {replySender && (
            <Avatar person={replySender} size="h-7 w-7" />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#0390fc]">
              Replying to {replySender?.display_name ?? 'Unknown user'}
            </p>
            <p className="truncate text-xs text-gray-400">
              {replyingTo.content ||
                (replyingTo.attachment_name
                  ? `Attachment: ${replyingTo.attachment_name}`
                  : 'Message')}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancelReply}
            disabled={sendingMessage}
            className="rounded-md px-2 py-1 text-lg text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            ×
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#41434c] bg-[#202127] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#34353d]">
            📎
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">
              {formatSize(selectedFile.size)}
            </p>
          </div>

          <button
            type="button"
            disabled={sendingMessage}
            onClick={() => setSelectedFile(null)}
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Remove attachment"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl bg-[#34353d] p-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => handleFileChange(event.target.files?.[0])}
        />

        <button
          type="button"
          disabled={sendingMessage}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
          aria-label="Attach file"
          title="Attach file"
        >
          +
        </button>

        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={`Chat with ${recipientName}. Under 2000 characters.`}
          maxLength={2000}
          rows={1}
          className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500"
        />

        <button
          type="submit"
          disabled={(!messageText.trim() && !selectedFile) || sendingMessage}
          className="rounded-lg bg-[#0390fc] px-4 py-2 text-sm font-semibold hover:bg-[#0390fc] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendingMessage ? 'Sending...' : 'Send'}
        </button>
      </div>

      <p className="mt-2 px-2 text-[11px] text-gray-500">
        Enter to send · Shift + Enter for a new line · Max file size 10 MB
      </p>
    </form>
  )
}