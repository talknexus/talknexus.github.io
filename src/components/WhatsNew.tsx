import { useEffect, useId, useRef } from 'react'

export type WhatsNewItem = {
  title: string
  description: string
}

export type WhatsNewSection = {
  name: string
  items: WhatsNewItem[]
}

export type WhatsNewRelease = {
  version: string
  title: string
  releaseDate: string
  sections: WhatsNewSection[]
}

type WhatsNewProps = {
  release: WhatsNewRelease
  open?: boolean
  onClose: () => void
}

function formatReleaseDate(releaseDate: string) {
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(releaseDate)
      ? `${releaseDate}T00:00:00`
      : releaseDate,
  )

  if (Number.isNaN(date.getTime())) return releaseDate

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export default function WhatsNew({
  release,
  open = true,
  onClose,
}: WhatsNewProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const gotItRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    gotItRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#090a0d]/80 p-4 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#34353d] bg-[#1e1f24] text-[#f2f3f5] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[#34353d] px-6 py-5">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0390fc]">
              What's New · {release.version}
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-white">
              {release.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-gray-400"
            >
              {formatReleaseDate(release.releaseDate)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-gray-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0390fc]"
            aria-label="Close What's New"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {release.sections.map((section) => (
              <section key={section.name}>
                <h3 className="mb-3 text-sm font-bold text-[#0390fc]">
                  {section.name}
                </h3>
                <div className="space-y-4">
                  {section.items.map((item) => (
                    <p
                      key={`${section.name}-${item.title}`}
                      className="text-sm leading-relaxed text-gray-300"
                    >
                      <span className="font-bold text-white">{item.title}</span>
                      {' — '}
                      <span>{item.description}</span>
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#34353d] px-6 py-4">
          <button
            ref={gotItRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[#0390fc] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#168ff0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0390fc]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
