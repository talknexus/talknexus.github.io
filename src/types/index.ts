export type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  banner_url?: string | null
  bio?: string
}

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export type FriendEntry = {
  friendship: Friendship
  profile: Profile
}

export type SettingsProfile = {
  username: string
  display_name: string
  avatar_url: string | null
}

export type Conversation = {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
}

export type DmMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  attachment_name: string | null
  attachment_path: string | null
  attachment_mime_type: string | null
  attachment_size: number | null
  reply_to_message_id: string | null
}

export type ConversationEntry = {
  conversation: Conversation
  profile: Profile
  lastMessage: DmMessage | null
}