
import type { Profile, SettingsProfile } from '../types'

type AvatarProps = {
  person: Profile | SettingsProfile
  size?: string
}

export default function Avatar({ person, size = 'w-10 h-10' }: AvatarProps) {
  const initial = person.display_name?.charAt(0).toUpperCase() || '?'

  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt={`${person.display_name}'s avatar`}
        className={`${size} rounded-full object-cover shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${size} rounded-full bg-[#0390fc] flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {initial}
    </div>
  )
}
