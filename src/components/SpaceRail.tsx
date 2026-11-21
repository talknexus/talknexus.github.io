
import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import type { ConversationEntry } from '../types'

type SpaceRailProps = {
  onHome: () => void
  conversations: ConversationEntry[]
  activeConversationId: string | null
  unreadCounts: Record<string, number>
  onSelectConversation: (conversationId: string) => void
}

type AnimationState = 'entering' | 'visible' | 'exiting'

export default function SpaceRail({
  onHome,
  conversations,
  activeConversationId,
  unreadCounts,
  onSelectConversation,
}: SpaceRailProps) {
  const unreadIds = conversations
    .filter((entry) => (unreadCounts[entry.conversation.id] || 0) > 0)
    .map((entry) => entry.conversation.id)
  const unreadKey = unreadIds
    .map((id) => `${id}:${unreadCounts[id] || 0}`)
    .join('|')

  const [animationStates, setAnimationStates] = useState<
    Record<string, AnimationState>
  >({})
  const [orderedUnreadIds, setOrderedUnreadIds] = useState<string[]>([])
  const previousCounts = useRef<Record<string, number>>({})
  const initializedUnreadOrder = useRef(false)

  useEffect(() => {
    const currentUnreadIds = unreadKey
      ? unreadKey.split('|').map((entry) => entry.split(':')[0])
      : []
    const currentCounts = Object.fromEntries(
      unreadIds.map((id) => [id, unreadCounts[id] || 0]),
    )
    const previous = previousCounts.current

    setOrderedUnreadIds((existingOrder) => {
      if (!initializedUnreadOrder.current) {
        initializedUnreadOrder.current = true
        return unreadIds
      }

      const newestIds = currentUnreadIds.filter(
        (id) =>
          (currentCounts[id] || 0) > (previous[id] || 0),
      )
      const remainingIds = currentUnreadIds.filter(
        (id) => !newestIds.includes(id),
      )
      const existingIds = existingOrder.filter(
        (id) => currentUnreadIds.includes(id),
      )
      const existingRemaining = existingIds.filter(
        (id) => !newestIds.includes(id),
      )

      return [
        ...newestIds,
        ...existingRemaining,
        ...remainingIds.filter((id) => !existingRemaining.includes(id)),
      ]
    })

    setAnimationStates((current) => {
      const next = { ...current }

      currentUnreadIds.forEach((id) => {
        if (!next[id] || next[id] === 'exiting') {
          next[id] = 'entering'
        }
      })

      Object.keys(next).forEach((id) => {
        if (!currentUnreadIds.includes(id)) {
          next[id] = 'exiting'
        }
      })

      return next
    })

    previousCounts.current = currentCounts

    let secondFrame = 0

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setAnimationStates((current) => {
          const next = { ...current }

          Object.keys(next).forEach((id) => {
            if (next[id] === 'entering') {
              next[id] = 'visible'
            }
          })

          return next
        })
      })
    })

    const timeout = window.setTimeout(() => {
      setAnimationStates((current) => {
        const next = { ...current }

        Object.keys(next).forEach((id) => {
          if (next[id] === 'exiting' && !currentUnreadIds.includes(id)) {
            delete next[id]
          }
        })

        return next
      })
    }, 220)

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      window.clearTimeout(timeout)
    }
  }, [unreadKey])

  const conversationMap = new Map(
    conversations.map((entry) => [entry.conversation.id, entry]),
  )
  const displayedConversations = orderedUnreadIds
    .map((id) => conversationMap.get(id))
    .filter((entry): entry is ConversationEntry => Boolean(entry))

  return (
    <aside className="flex h-full w-[72px] shrink-0 flex-col items-center gap-4 overflow-hidden bg-[#111216] py-4">
      {/* Home */}
      <button
        onClick={onHome}
        title="Home"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0390fc] text-xl font-bold hover:bg-[#0390fc]"
      >
        <img
          src={`${import.meta.env.BASE_URL}nexus-logo-white.png`}
          alt="NEXUS"
          className="h-8 w-8 object-contain"
        />
      </button>

      {/* Unread Direct Messages */}
      <div className="flex w-full flex-1 flex-col items-center gap-3 overflow-y-auto overflow-x-hidden">
        {displayedConversations.map((entry) => {
          const conversationId = entry.conversation.id
          const unread = unreadCounts[conversationId] || 0
          const active = activeConversationId === conversationId
          const state = animationStates[conversationId]
          const exiting = state === 'exiting'

          return (
            <div
              key={conversationId}
              className={`w-12 shrink-0 overflow-hidden transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none ${
                exiting ? 'h-0 opacity-0' : 'h-12 opacity-100'
              }`}
            >
              <button
                onClick={() => onSelectConversation(conversationId)}
                title={entry.profile.display_name}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ease-out motion-reduce:transition-none ${
                  state === 'visible' && !exiting
                    ? 'scale-100'
                    : 'scale-0'
                } ${
                  active
                    ? 'rounded-2xl ring-2 ring-[#0390fc]'
                    : 'hover:rounded-2xl'
                }`}
              >
                <Avatar person={entry.profile} size="h-12 w-12" />

                {unread > 0 && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#111216] bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Space section */}
      <div className="h-[2px] w-8 shrink-0 rounded-full bg-[#303136]" />

      {/* Create or join a Space */}
      <button
        title="Create or join a Space"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#292a30] text-lg hover:bg-[#0390fc]"
      >
        +
      </button>
    </aside>
  )
}
