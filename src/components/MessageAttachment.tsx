import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DmMessage } from '../types'

type Props = {
  message: DmMessage
}

const MAX_CACHE_SIZE = 75 * 1024 * 1024
const attachmentCache = new Map<string, Blob>()
let cachedBytes = 0

function getCachedAttachment(path: string) {
  const blob = attachmentCache.get(path)

  if (!blob) return null

  attachmentCache.delete(path)
  attachmentCache.set(path, blob)

  return blob
}

function cacheAttachment(path: string, blob: Blob) {
  if (blob.size > MAX_CACHE_SIZE) return

  const existing = attachmentCache.get(path)

  if (existing) {
    cachedBytes -= existing.size
    attachmentCache.delete(path)
  }

  while (
    cachedBytes + blob.size > MAX_CACHE_SIZE &&
    attachmentCache.size > 0
  ) {
    const oldestPath = attachmentCache.keys().next().value

    if (!oldestPath) break

    const oldestBlob = attachmentCache.get(oldestPath)

    if (oldestBlob) cachedBytes -= oldestBlob.size

    attachmentCache.delete(oldestPath)
  }

  attachmentCache.set(path, blob)
  cachedBytes += blob.size
}

function formatSize(bytes: number | null) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const codeExtensions = new Set([
  'txt', 'md', 'py', 'js', 'jsx', 'ts', 'tsx', 'lua',
  'json', 'html', 'css', 'xml', 'yaml', 'yml', 'sql',
  'sh', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs',
  'php', 'rb', 'swift', 'kt', 'toml', 'ini',
])

const videoExtensions = new Set([
  'mp4', 'mov', 'webm', 'm4v', 'ogv', '3gp', 'mpeg', 'mpg',
])

export default function MessageAttachment({ message }: Props) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(false)

  const path = message.attachment_path
  const name = message.attachment_name || 'Attachment'
  const mime = message.attachment_mime_type || ''
  const size = message.attachment_size
  const extension = name.split('.').pop()?.toLowerCase() || ''

  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(extension)

  const isVideo =
    videoExtensions.has(extension) ||
    mime.startsWith('video/')

  const isAudio =
    ['mp3', 'wav'].includes(extension) ||
    (extension === 'ogg' && (!mime || mime.startsWith('audio/')))

  const isCode = codeExtensions.has(extension) && (size ?? 0) <= 1024 * 1024

  useEffect(() => {
    if (!path) {
      setLoading(false)
      return
    }

    let cancelled = false
    let objectUrl = ''

    async function loadAttachment() {
      setLoading(true)
      setError('')
      setUrl('')
      setText('')

      let data = getCachedAttachment(path!)

      if (!data) {
        const { data: downloaded, error: downloadError } = await supabase.storage
          .from('dm-attachments')
          .download(path!)

        if (cancelled) return

        if (downloadError || !downloaded) {
          setError('Unable to load attachment.')
          setLoading(false)
          return
        }

        data = downloaded
        cacheAttachment(path!, data)
      }

      if (cancelled) return

      objectUrl = URL.createObjectURL(data)
      setUrl(objectUrl)

      if (isCode) {
        try {
          setText(await data.text())
        } catch {
          setText('Unable to preview this text file.')
        }
      }

      if (!cancelled) setLoading(false)
    }

    loadAttachment()

    return () => {
      cancelled = true

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [path, isCode])

  if (!path) return null

  if (loading) {
    if (isImage) {
      return (
        <div className="mt-2 h-80 w-full max-w-lg overflow-hidden rounded-lg bg-[#202127]">
          <div className="flex h-full w-full animate-pulse items-center justify-center">
            <span className="text-xs text-gray-500">Loading image...</span>
          </div>
        </div>
      )
    }

    if (isVideo) {
      return (
        <div className="mt-2 w-full max-w-xl overflow-hidden rounded-lg border border-[#41434c] bg-[#202127]">
          <div className="flex aspect-video animate-pulse items-center justify-center bg-black">
            <span className="text-xs text-gray-400">Loading video...</span>
          </div>
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-[#41434c]" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-[#34353d]" />
          </div>
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="mt-2 max-w-md rounded-lg border border-[#41434c] bg-[#202127] p-3">
          <p className="mb-3 truncate text-xs text-gray-400">{name}</p>
          <div className="h-10 w-full animate-pulse rounded bg-[#34353d]" />
        </div>
      )
    }

    if (isCode) {
      return (
        <div className="mt-2 h-52 max-w-2xl overflow-hidden rounded-lg border border-[#41434c] bg-[#1b1c21]">
          <div className="border-b border-[#41434c] p-3">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#41434c]" />
          </div>
          <div className="space-y-3 p-3">
            <div className="h-2 w-4/5 animate-pulse rounded bg-[#34353d]" />
            <div className="h-2 w-3/5 animate-pulse rounded bg-[#34353d]" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-[#34353d]" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-[#34353d]" />
          </div>
        </div>
      )
    }

    return (
      <div className="mt-2 flex min-h-[74px] max-w-md items-center gap-3 rounded-lg border border-[#41434c] bg-[#202127] p-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[#34353d]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-[#41434c]" />
          <div className="h-2 w-1/3 animate-pulse rounded bg-[#34353d]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-2 rounded-lg border border-[#41434c] p-3 text-xs text-gray-400">
        {name} · {formatSize(size)} · {error}
      </div>
    )
  }

  if (isImage && url) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="mt-2 block h-80 w-full max-w-lg cursor-zoom-in overflow-hidden rounded-lg bg-[#202127]"
        >
          <img
            src={url}
            alt={name}
            className="h-full w-full object-contain"
          />
        </button>

        {lightbox && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              className="absolute right-5 top-5 text-2xl text-white"
              onClick={() => setLightbox(false)}
            >
              ×
            </button>
            <img
              src={url}
              alt={name}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
          </div>
        )}
      </>
    )
  }

  if (isVideo && url) {
    return (
      <div className="mt-2 w-full max-w-xl overflow-hidden rounded-lg border border-[#41434c] bg-[#202127]">
        <video
          controls
          preload="metadata"
          src={url}
          className="aspect-video max-h-[400px] w-full bg-black"
        >
          Your browser does not support embedded video playback.
        </video>

        <div className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="text-xs text-gray-400">
              {formatSize(size)} · {mime || 'Video'}
            </p>
          </div>

          <a
            href={url}
            download={name}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Download
          </a>
        </div>
      </div>
    )
  }

  if (isAudio && url) {
    return (
      <div className="mt-2 max-w-md rounded-lg border border-[#41434c] bg-[#202127] p-3">
        <p className="mb-2 truncate text-xs text-gray-300">{name}</p>
        <audio controls src={url} className="w-full" />
      </div>
    )
  }

  if (isCode && url) {
    return (
      <div className="mt-2 max-w-2xl overflow-hidden rounded-lg border border-[#41434c] bg-[#1b1c21]">
        <div className="flex items-center justify-between border-b border-[#41434c] px-3 py-2">
          <span className="truncate text-xs text-gray-300">{name}</span>
          <a
            href={url}
            download={name}
            className="ml-3 text-xs text-indigo-400 hover:text-indigo-300"
          >
            Download
          </a>
        </div>

        <pre className={`overflow-x-auto p-3 text-xs text-gray-300 ${expanded ? 'max-h-[600px]' : 'max-h-40'}`}>
          <code>{expanded ? text : text.slice(0, 1200)}</code>
        </pre>

        {text.length > 1200 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="border-t border-[#41434c] px-3 py-2 text-xs text-indigo-400"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 flex min-h-[74px] max-w-md items-center gap-3 rounded-lg border border-[#41434c] bg-[#202127] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#34353d] text-lg">
        📄
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-gray-400">
          {formatSize(size)} · {mime || 'File'}
        </p>
      </div>

      {url && (
        <a
          href={url}
          download={name}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          Download
        </a>
      )}
    </div>
  )
}
