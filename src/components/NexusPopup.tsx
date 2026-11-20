import { createPortal } from 'react-dom'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type NexusPopupType =
  | 'info'
  | 'success'
  | 'error'
  | 'warning'
  | 'confirmation'
  | 'danger'

export type NexusPopupOptions = {
  title: string
  message: ReactNode
  type?: NexusPopupType
  confirmText?: string
  cancelText?: string
}

type PopupItem = NexusPopupOptions & {
  id: number
  resolve: (confirmed: boolean) => void
}

let popupId = 0
let openPopupHandler: ((popup: PopupItem) => void) | null = null

function openPopup(options: NexusPopupOptions): Promise<boolean> {
  if (!openPopupHandler) {
    return Promise.resolve(false)
  }

  return new Promise((resolve) => {
    openPopupHandler?.({
      ...options,
      id: ++popupId,
      resolve,
    })
  })
}

export function showAlert(options: NexusPopupOptions): Promise<void> {
  return openPopup(options).then(() => undefined)
}

export function showConfirm(options: NexusPopupOptions): Promise<boolean> {
  return openPopup({
    type: 'confirmation',
    cancelText: 'Cancel',
    confirmText: 'Confirm',
    ...options,
  })
}

function PopupIcon({ type }: { type: NexusPopupType }) {
  const common = 'h-7 w-7'

  if (type === 'success') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m5 12 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'error' || type === 'danger') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5m0 3.5v.01M10.3 4.1 3.2 16.5A2 2 0 0 0 4.9 19h14.2a2 2 0 0 0 1.7-2.5L13.7 4.1a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'warning') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5v5m0 3.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'confirmation') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 2M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5m0-8v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function NexusPopupProvider({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<PopupItem | null>(null)
  const [closing, setClosing] = useState(false)
  const queue = useRef<PopupItem[]>([])
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openPopupHandler = (nextPopup) => {
      if (popup) {
        queue.current.push(nextPopup)
      } else {
        previouslyFocused.current = document.activeElement as HTMLElement | null
        setPopup(nextPopup)
      }
    }

    return () => {
      openPopupHandler = null
    }
  }, [popup])

  useEffect(() => {
    if (!popup) return

    const frame = window.requestAnimationFrame(() => {
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button')
      const preferred = Array.from(buttons ?? []).find((button) =>
        button.dataset.preferred === 'true',
      )
      preferred?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePopup(popup?.type === 'confirmation' || popup?.type === 'danger'
          ? false
          : true)
        return
      }

      if (event.key !== 'Tab') return
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      )
      if (!buttons?.length) return

      const first = buttons[0]
      const last = buttons[buttons.length - 1]
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
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popup])

  function closePopup(confirmed: boolean) {
    if (!popup || closing) return
    setClosing(true)

    window.setTimeout(() => {
      popup.resolve(confirmed)
      const next = queue.current.shift() ?? null
      setPopup(next)
      setClosing(false)

      if (!next) {
        previouslyFocused.current?.focus()
      }
    }, 180)
  }

  const type = popup?.type ?? 'info'
  const destructive = type === 'danger'
  const confirmLabel =
    popup?.confirmText ??
    (type === 'error' ? 'Got it' : type === 'success' ? 'Alright' : 'Continue')
  const cancelLabel = popup?.cancelText ?? 'Cancel'
  const isConfirmation =
    type === 'confirmation' || destructive || type === 'warning'

  const style =
    destructive || type === 'error'
      ? 'border-red-500/20 bg-red-500/10 text-red-400'
      : type === 'warning'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
        : type === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border-[#0390fc]/20 bg-[#0390fc]/10 text-[#0390fc]'

  return (
    <>
      {children}
      {popup && createPortal(
        <div
          className={`nexus-popup-backdrop ${closing ? 'nexus-popup-closing' : ''}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePopup(isConfirmation ? false : true)
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`nexus-popup-title-${popup.id}`}
            aria-describedby={`nexus-popup-message-${popup.id}`}
            className={`nexus-popup-panel ${
              isConfirmation ? 'nexus-popup-confirmation' : ''
            }`}
          >
            <div className="nexus-popup-brand" aria-hidden="true">
              NEXUS
            </div>
            <div className={`nexus-popup-kind nexus-popup-kind-${type}`} aria-hidden="true">
              {type === 'danger' || type === 'confirmation'
                ? 'Confirmation'
                : type === 'success'
                  ? 'Success'
                  : type === 'error'
                    ? 'Error'
                    : type === 'warning'
                      ? 'Warning'
                      : 'Information'}
            </div>

            <div className="nexus-popup-content">
              <div className={`nexus-popup-icon ${style}`}>
                <PopupIcon type={type} />
              </div>
              <h2
                id={`nexus-popup-title-${popup.id}`}
                className="text-lg font-bold text-white"
              >
                {popup.title}
              </h2>
              <div
                id={`nexus-popup-message-${popup.id}`}
                className="mt-2 text-sm leading-relaxed text-gray-300"
              >
                {popup.message}
              </div>
            </div>

            <div className="nexus-popup-actions">
              {isConfirmation && (
                <button
                  type="button"
                  data-preferred="true"
                  onClick={() => closePopup(false)}
                  className="nexus-popup-button nexus-popup-button-secondary"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                data-preferred={!isConfirmation ? 'true' : 'false'}
                onClick={() => closePopup(true)}
                className={`nexus-popup-button ${
                  destructive
                    ? 'nexus-popup-button-danger'
                    : 'nexus-popup-button-primary'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
