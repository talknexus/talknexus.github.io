
import type { Profile, SettingsProfile } from '../types'

type AvatarProps = {
  person: Profile | SettingsProfile
  size?: string
}

export default function Avatar({ person, size = 'w-10 h-10' }: AvatarProps) {
  return (
    <img
      src={person.avatar_url || '/default-pfp.png'}
      alt={`${person.display_name}'s avatar`}
      className={`${size} rounded-full object-cover shrink-0`}
    />
  )
}
