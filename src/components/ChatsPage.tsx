import { useCallback, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import type {
  ConversationEntry,
  DmMessage,
  SettingsProfile,
} from '../types'
import type { MessageReaction } from '../hooks/useMessageReactions'
import type { FormEvent, Dispatch, SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import InviteMembersModal, {
  type InviteFriend,
} from './InviteMembersModal'
import { showAlert } from './NexusPopup'

type ChatsPageProps = {
  activeConversationId: string | null
  userId: string
  profile: SettingsProfile | null
  activeConversation: ConversationEntry | undefined
  pageError: string
  loadingMessages: boolean
  messages: DmMessage[]
  reactions: MessageReaction[]
  onToggleReaction: (messageId: string, emoji: string) => Promise<boolean>
  onEditMessage: (messageId: string, content: string) => Promise<boolean>
  onDeleteMessage: (messageId: string) => Promise<boolean>
  messageText: string
  setMessageText: Dispatch<SetStateAction<string>>
  selectedFile: File | null
  setSelectedFile: Dispatch<SetStateAction<File | null>>
  sendingMessage: boolean
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void
  replyingTo: DmMessage | null
  onReply: (message: DmMessage) => void
  onCancelReply: () => void
}

export default function ChatsPage({
  userId,
  profile,
  activeConversation,
  pageError,
  loadingMessages,
  messages,
  reactions,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  messageText,
  setMessageText,
  selectedFile,
  setSelectedFile,
  sendingMessage,
  onSendMessage,
  replyingTo,
  onReply,
  onCancelReply,
}: ChatsPageProps) {
  const messageListRef = useRef<HTMLDivElement>(null)
  const messageContentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const highlightTimeoutRef = useRef<number | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const [memberActionLoading, setMemberActionLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteConversationId, setInviteConversationId] = useState<string | null>(null)
  const [availableFriends, setAvailableFriends] = useState<InviteFriend[]>([])

  const isGroup = activeConversation?.conversation.is_group === true
  const groupMembers = activeConversation?.members ?? []
  const memberRoles = activeConversation?.memberRoles ?? {}

  async function openInvite() {
    if (!activeConversation || !isGroup) return
    setInviteConversationId(activeConversation.conversation.id)
    if (groupMembers.length >= 10) {
      setAvailableFriends([])
      setInviteOpen(true)
      return
    }

    const existingIds = new Set(groupMembers.map((member) => member.id))
    const { data: friendshipRows, error } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) {
      void showAlert({
        title: 'Could not load friends',
        message: error.message,
        type: 'error',
        confirmText: 'Got it',
      })
      return
    }

    const friendIds = [...new Set(
      (friendshipRows || []).map((friendship) =>
        friendship.requester_id === userId
          ? friendship.addressee_id
          : friendship.requester_id,
      ).filter((id) => !existingIds.has(id)),
    )]

    if (friendIds.length === 0) {
      setAvailableFriends([])
      setInviteOpen(true)
      return
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', friendIds)

    if (profilesError) {
      void showAlert({
        title: 'Could not load friends',
        message: profilesError.message,
        type: 'error',
        confirmText: 'Got it',
      })
      return
    }

    setAvailableFriends((profiles || []) as InviteFriend[])
    setInviteOpen(true)
  }

  async function inviteMember(memberId: string): Promise<boolean> {
    if (!activeConversation) return false
    setMemberActionLoading(true)
    const { error } = await supabase.rpc('invite_group_members', {
      p_conversation_id: activeConversation.conversation.id,
      p_member_ids: [memberId],
    })
    setMemberActionLoading(false)
    if (error) {
      void showAlert({
        title: 'Could not add member',
        message: error.message,
        type: 'error',
        confirmText: 'Got it',
      })
    }
    return !error
  }

  async function removeMember(memberId: string) {
    if (!activeConversation) return
    setMemberActionLoading(true)
    const { error } = await supabase.rpc('remove_group_member', {
      p_conversation_id: activeConversation.conversation.id,
      p_member_id: memberId,
    })
    setMemberActionLoading(false)
    if (error) {
      void showAlert({
        title: 'Could not remove member',
        message: error.message,
        type: 'error',
        confirmText: 'Got it',
      })
    }
  }

  async function leaveGroup() {
    if (!activeConversation) return
    setMemberActionLoading(true)
    const { error } = await supabase.rpc('leave_group', {
      p_conversation_id: activeConversation.conversation.id,
    })
    setMemberActionLoading(false)
    if (error) {
      void showAlert({
        title: 'Could not leave group',
        message: error.message,
        type: 'error',
        confirmText: 'Got it',
      })
    }
  }

  async function transferOwnership(memberId: string) {
    if (!activeConversation) return
    setMemberActionLoading(true)
    const { error } = await supabase.rpc('transfer_group_owner', {
      p_conversation_id: activeConversation.conversation.id,
      p_new_owner_id: memberId,
    })
    setMemberActionLoading(false)
    if (error) {
      void showAlert({
        title: 'Could not transfer ownership',
        message: error.message,
        type: 'error',
        confirmText: 'Got it',
      })
    }
  }

  useEffect(() => {
    isAtBottomRef.current = true
  }, [activeConversation?.conversation.id])

  useEffect(() => {
    const container = messageListRef.current

    if (container && isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, loadingMessages, activeConversation?.conversation.id])

  useEffect(() => {
    const container = messageListRef.current
    const content = messageContentRef.current

    if (!container || !content) return

    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        container.scrollTop = container.scrollHeight
      }
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [activeConversation?.conversation.id])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  const jumpToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`)

    if (!element) return

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })

    setHighlightedMessageId(messageId)

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null)
      highlightTimeoutRef.current = null
    }, 1800)
  }, [])

  const replyingSender = replyingTo
    ? replyingTo.sender_id === userId
      ? profile
      : isGroup
        ? activeConversation?.senderProfiles?.[replyingTo.sender_id]
          ?? groupMembers.find((member) => member.id === replyingTo.sender_id)
          ?? null
        : activeConversation?.profile ?? null
    : null

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#34353d] px-5">
              <Avatar person={activeConversation.profile} size="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {isGroup
                    ? activeConversation.conversation.name
                    : activeConversation.profile.display_name}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {isGroup
                    ? `${groupMembers.length} members`
                    : `@${activeConversation.profile.username}`}
                </p>
              </div>
            </header>

            {pageError && (
              <p className="m-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                {pageError}
              </p>
            )}

            <div
              ref={messageListRef}
              onScroll={(event) => {
                const container = event.currentTarget
                const distanceFromBottom =
                  container.scrollHeight -
                  container.scrollTop -
                  container.clientHeight

                isAtBottomRef.current = distanceFromBottom < 120
              }}
              className="min-h-0 flex-1 overflow-y-auto p-5 [overflow-anchor:none]"
            >
              <div ref={messageContentRef} className="min-h-full">
                {loadingMessages ? (
                  <p className="text-center text-sm text-gray-400">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <Avatar person={activeConversation.profile} size="h-16 w-16" />
                    <h3 className="mt-4 text-xl font-bold">
                      {activeConversation.profile.display_name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      This is the beginning of your conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const previousMessage = messages[index - 1]
                    const sameSender =
                      previousMessage?.sender_id === message.sender_id
                    const withinFiveMinutes =
                      previousMessage &&
                      new Date(message.created_at).getTime() -
                        new Date(previousMessage.created_at).getTime() <=
                        5 * 60 * 1000

                    const showHeader = !sameSender || !withinFiveMinutes
                    const replyToMessage = message.reply_to_message_id
                      ? messages.find(
                          (item) => item.id === message.reply_to_message_id,
                        ) ?? null
                      : null

                    const replySender = replyToMessage
                      ? replyToMessage.sender_id === userId && profile
                        ? profile
                        : isGroup
                          ? activeConversation.senderProfiles?.[replyToMessage.sender_id]
                            ?? groupMembers.find(
                                (member) => member.id === replyToMessage.sender_id,
                              )
                            ?? activeConversation.profile
                          : activeConversation.profile
                      : null

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        sender={
                          message.sender_id === userId && profile
                            ? profile
                            : isGroup
                              ? activeConversation.senderProfiles?.[message.sender_id]
                                ?? groupMembers.find(
                                    (member) => member.id === message.sender_id,
                                  )
                                ?? activeConversation.profile
                              : activeConversation.profile
                        }
                        showHeader={showHeader}
                        reactions={reactions.filter(
                          (reaction) => reaction.message_id === message.id,
                        )}
                        userId={userId}
                        onToggleReaction={onToggleReaction}
                        onEditMessage={onEditMessage}
                        onDeleteMessage={onDeleteMessage}
                        onReply={onReply}
                        replyToMessage={replyToMessage}
                        replySender={replySender}
                        onJumpToMessage={jumpToMessage}
                        isHighlighted={highlightedMessageId === message.id}
                      />
                    )
                  })
                )}
              </div>
            </div>

            <MessageComposer
              messageText={messageText}
              setMessageText={setMessageText}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              sendingMessage={sendingMessage}
              recipientName={activeConversation.profile.display_name}
              replyingTo={replyingTo}
              replySender={replyingSender}
              onCancelReply={onCancelReply}
              onSubmit={onSendMessage}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#34353d] text-4xl">
              💬
            </div>
            <h2 className="text-2xl font-bold">Your messages</h2>
            <p className="mt-2 max-w-md text-sm text-gray-400">
              Select a DM to start chatting, or message a friend
              from your <a href="/friends" className="text-blue-400 hover:underline">
                Friends list
              </a>.
            </p>
          </div>
        )}
      </section>

      {isGroup && (
        <aside className="flex w-64 shrink-0 flex-col border-l border-[#34353d] bg-[#1e1f24] max-lg:hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#34353d] px-4">
            <h3 className="text-sm font-semibold">Members · {groupMembers.length}</h3>
            {memberRoles[userId] === 'owner' && (
              <button
                type="button"
                onClick={openInvite}
                className="rounded-md px-2 py-1 text-sm text-[#0390fc] hover:bg-[#0390fc]/10"
              >
                Invite
              </button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-2">
            {groupMembers.map((member) => {
              const role = memberRoles[member.id]
              const isOwner = role === 'owner'
              return (
                <div
                  key={member.id}
                  className="mb-1 flex items-center gap-2 rounded-lg p-2"
                >
                  <Avatar person={member} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.display_name}
                      {isOwner && (
                        <span className="ml-1 text-[#0390fc]" title="Owner" aria-label="Owner">
                          👑
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      @{member.username}
                    </p>
                  </div>

                  {memberRoles[userId] === 'owner' && !isOwner && (
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-gray-400 hover:bg-[#34353d]">
                        ⋯
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-[#34353d] bg-[#17181c] p-1 shadow-xl">
                        <button
                          type="button"
                          disabled={memberActionLoading}
                          onClick={() => transferOwnership(member.id)}
                          className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#292a30] disabled:opacity-50"
                        >
                          Make owner
                        </button>
                        <button
                          type="button"
                          disabled={memberActionLoading}
                          onClick={() => removeMember(member.id)}
                          className="w-full rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>

          {memberRoles[userId] !== 'owner' && (
            <div className="border-t border-[#34353d] p-3">
              <button
                type="button"
                disabled={memberActionLoading}
                onClick={leaveGroup}
                className="w-full rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                Leave Group
              </button>
            </div>
          )}
        </aside>
      )}

      {isGroup && (
        <InviteMembersModal
          open={
            inviteOpen &&
            inviteConversationId === activeConversation?.conversation.id
          }
          full={groupMembers.length >= 10}
          friends={availableFriends}
          onClose={() => setInviteOpen(false)}
          onAdd={inviteMember}
        />
      )}
    </div>
  )
}