
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import useFriendships from '../hooks/useFriendships'
import useConversations from '../hooks/useConversations'
import useMessages from '../hooks/useMessages'
import useMessageReactions from '../hooks/useMessageReactions'
import useDmNotifications from '../hooks/useDmNotifications'

import SpaceRail from '../components/SpaceRail'
import AppSidebar from '../components/AppSidebar'
import FriendsPage from '../components/FriendsPage'
import ChatsPage from '../components/ChatsPage'
import AddFriendModal from '../components/AddFriendModal'

import type {
  Profile,
  SettingsProfile,
  DmMessage,
} from '../types'

function AppHome() {
  const [activePage, setActivePage] = useState<'friends' | 'chats'>('friends')
  const [activeFriendTab, setActiveFriendTab] = useState<'all' | 'pending'>('all')

  const [profile, setProfile] = useState<SettingsProfile | null>(null)
  const [userId, setUserId] = useState('')

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replyingTo, setReplyingTo] = useState<DmMessage | null>(null)

  const [loadingProfile, setLoadingProfile] = useState(true)

  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendUsername, setFriendUsername] = useState('')

  const [pageError, setPageError] = useState('')

  const clearActiveConversation = useCallback(() => {
    setActiveConversationId(null)
    setReplyingTo(null)
  }, [])

  const {
    friends,
    incomingRequests,
    outgoingRequests,
    loadingFriends,
    requestLoading,
    friendError,
    friendSuccess,
    addingFriend,
    loadFriendships,
    sendFriendRequest: sendFriendshipRequest,
    respondToRequest,
    unfriend,
    setFriendError,
    setFriendSuccess,
  } = useFriendships({
    userId,
    profile,
    setPageError,
  })

  const {
    conversations,
    loadingConversations,
    loadConversations,
  } = useConversations({
    setPageError,
    clearActiveConversation,
  })

  const {
    messages,
    loadingMessages,
    sendingMessage,
    sendMessage: sendDmMessage,
    editMessage,
    deleteMessage,
  } = useMessages({
    userId,
    activeConversationId,
    setPageError,
    loadConversations,
  })

  const activeConversation = conversations.find(
    (entry) => entry.conversation.id === activeConversationId,
  )

  const {
    reactions,
    toggleReaction,
  } = useMessageReactions({
    conversationId: activeConversationId,
    messageIds: messages.map((message) => message.id),
    userId,
  })

  const { unreadCounts } = useDmNotifications({
    userId,
    conversations,
    activeConversationId:
      activePage === 'chats' ? activeConversationId : null,
  })

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setLoadingProfile(false)
        return
      }

      if (cancelled) return

      setUserId(user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      if (error) {
        console.error('Could not load profile:', error.message)
      } else {
        setProfile(data)
      }

      setLoadingProfile(false)

      await Promise.all([
        loadFriendships(user.id),
        loadConversations(user.id),
      ])
    }

    initialize()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`friendships-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          loadFriendships(userId)
          loadConversations(userId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`dm-list-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dm_messages',
        },
        () => {
          loadConversations(userId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function openConversation(person: Profile) {
    if (!userId) return

    setPageError('')
    setReplyingTo(null)

    const [firstUser, secondUser] = [userId, person.id].sort()

    const { data, error } = await supabase
      .from('dm_conversations')
      .select('id')
      .eq('user1_id', firstUser)
      .eq('user2_id', secondUser)
      .maybeSingle()

    if (error) {
      setPageError(error.message)
      return
    }

    if (!data) {
      setPageError('No DM conversation exists with this user yet.')
      return
    }

    setActiveConversationId(data.id)
    setActivePage('chats')
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const cleanMessage = messageText.trim()

    if (!cleanMessage && !selectedFile) return

    const sent = await sendDmMessage(
      cleanMessage,
      selectedFile,
      replyingTo?.id ?? null,
    )

    if (sent) {
      setMessageText('')
      setSelectedFile(null)
      setReplyingTo(null)
    }
  }

  async function sendFriendRequest() {
    const sent = await sendFriendshipRequest(friendUsername)

    if (sent) {
      setFriendUsername('')
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17181c] text-gray-400">
        Loading NEXUS...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#17181c] text-[#f2f3f5]">
      <SpaceRail
        onHome={() => {
          setActivePage('friends')
          clearActiveConversation()
          setPageError('')
        }}
        conversations={conversations}
        activeConversationId={activeConversationId}
        unreadCounts={unreadCounts}
        onSelectConversation={(id) => {
          setActiveConversationId(id)
          setReplyingTo(null)
          setActivePage('chats')
          setPageError('')
        }}
      />

      <AppSidebar
        activePage={activePage}
        onNavigate={(page) => {
          setActivePage(page)

          if (page !== 'chats') {
            clearActiveConversation()
          }

          setPageError('')
        }}
        incomingCount={incomingRequests.length}
        conversations={conversations}
        unreadCounts={unreadCounts}
        loadingConversations={loadingConversations}
        activeConversationId={activeConversationId}
        userId={userId}
        onSelectConversation={(id) => {
          setActiveConversationId(id)
          setReplyingTo(null)
          setActivePage('chats')
          setPageError('')
        }}
        profile={profile}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-[#24252b]">
        {activePage === 'friends' ? (
          <FriendsPage
            activeFriendTab={activeFriendTab}
            setActiveFriendTab={setActiveFriendTab}
            friends={friends}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            loadingFriends={loadingFriends}
            pageError={pageError}
            requestLoading={requestLoading}
            onOpenAddFriend={() => {
              setShowAddFriend(true)
              setFriendError('')
              setFriendSuccess('')
            }}
            onOpenConversation={openConversation}
            onUnfriend={unfriend}
            onRespondToRequest={respondToRequest}
          />
        ) : (
          <ChatsPage
            activeConversationId={activeConversationId}
            userId={userId}
            profile={profile}
            activeConversation={activeConversation}
            pageError={pageError}
            loadingMessages={loadingMessages}
            messages={messages}
            reactions={reactions}
            onToggleReaction={toggleReaction}
            onEditMessage={editMessage}
            onDeleteMessage={deleteMessage}
            messageText={messageText}
            setMessageText={setMessageText}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            sendingMessage={sendingMessage}
            onSendMessage={sendMessage}
            replyingTo={replyingTo}
            onReply={setReplyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        )}
      </main>

      <AddFriendModal
        open={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        username={friendUsername}
        setUsername={setFriendUsername}
        error={friendError}
        success={friendSuccess}
        adding={addingFriend}
        onSubmit={sendFriendRequest}
      />
    </div>
  )
}

export default AppHome
