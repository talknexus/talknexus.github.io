export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  banner_url?: string | null
  bio?: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface FriendEntry {
  friendship: Friendship
  profile: Profile
}

export interface SettingsProfile {
  username: string
  display_name: string
  avatar_url: string | null
}

export interface Conversation {
  id: string
  user1_id: string | null
  user2_id: string | null
  created_at: string
  is_group: boolean
  name: string | null
  avatar_url: string | null
  owner_id: string | null
}

export interface ConversationMember {
  conversation_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface DmMessage {
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

export interface ConversationEntry {
  conversation: Conversation
  profile: Profile
  lastMessage: DmMessage | null
  members?: Profile[]
  memberRoles?: Record<string, 'owner' | 'member'>
  senderProfiles?: Record<string, Profile>
}
