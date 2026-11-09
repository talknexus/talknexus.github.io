import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type SettingsTab = 'profile' | 'account' | 'security'
type ImageType = 'avatar' | 'banner'

type Profile = {
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  banner_url: string | null
}

function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError || !user) {
        setError('Could not retrieve your account.')
        setLoading(false)
        return
      }

      setEmail(user.email || '')

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('username, display_name, bio, avatar_url, banner_url')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError('Could not load your profile.')
        setLoading(false)
        return
      }

      setProfile(data)
      setUsername(data.username)
      setDisplayName(data.display_name)
      setBio(data.bio || '')

      setLoading(false)
    }

    loadProfile()
  }, [])

  async function saveProfile() {
    if (!profile) return

    setError('')
    setSuccess('')

    const cleanUsername = username.trim().toLowerCase()
    const cleanDisplayName = displayName.trim()
    const cleanBio = bio.trim()

    if (!/^[a-z0-9]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3–24 characters and contain only lowercase letters and numbers.')
      return
    }

    if (cleanDisplayName.length < 1 || cleanDisplayName.length > 32) {
      setError('Display name must be between 1 and 32 characters.')
      return
    }

    if (cleanBio.length > 1000) {
      setError('Your bio cannot exceed 1000 characters.')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You are not logged in.')
      setSaving(false)
      return
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
        bio: cleanBio,
      })
      .eq('id', user.id)
      .select('username, display_name, bio, avatar_url, banner_url')
      .single()

    setSaving(false)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('That username is already taken.')
      } else {
        setError(updateError.message)
      }
      return
    }

    setProfile(data)
    setUsername(data.username)
    setDisplayName(data.display_name)
    setBio(data.bio || '')
    setSuccess('Your changes have been saved!')
  }

  async function handleLogout() {
    setError('')
    setSuccess('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    window.location.href = '/'
  }

  async function uploadImage(file: File, type: ImageType) {
    setError('')
    setSuccess('')

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PNG, JPG, or WebP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Images must be 5 MB or smaller.')
      return
    }

    const { data: { user }, error: userError } =
      await supabase.auth.getUser()

    if (userError || !user) {
      setError('You must be logged in to upload images.')
      return
    }

    if (type === 'avatar') {
      setUploadingAvatar(true)
    } else {
      setUploadingBanner(true)
    }

    const extension = file.type === 'image/jpeg'
      ? 'jpg'
      : file.type.split('/')[1]

    const path = `${user.id}/${type}-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setUploadingAvatar(false)
      setUploadingBanner(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(path)

    const imageUrl = urlData.publicUrl

    const column = type === 'avatar' ? 'avatar_url' : 'banner_url'

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [column]: imageUrl })
      .eq('id', user.id)

    if (updateError) {
      setError(`Image uploaded, but profile update failed: ${updateError.message}`)
      setUploadingAvatar(false)
      setUploadingBanner(false)
      return
    }

    setProfile((current) =>
      current ? { ...current, [column]: imageUrl } : current
    )

    setSuccess(
      type === 'avatar'
        ? 'Your profile picture has been updated!'
        : 'Your profile banner has been updated!'
    )

    setUploadingAvatar(false)
    setUploadingBanner(false)
  }

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: '👤' },
    { id: 'account', label: 'My Account', icon: '⚙️' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ] as const

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#17181c] text-gray-400">
        Loading your settings...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#17181c] text-[#f2f3f5]">

      {/* Settings sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-[#292a30] bg-[#1e1f24]">

        <div className="flex h-16 items-center border-b border-[#292a30] px-5">
          <Link to="/app" className="text-lg font-black tracking-wide hover:text-[#0390fc]">
            NEXUS
          </Link>
        </div>

        <div className="flex-1 p-4">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-gray-500">
            User Settings
          </p>

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setError('')
                setSuccess('')
              }}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-[#34353d] text-white'
                  : 'text-gray-400 hover:bg-[#292a30] hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="border-t border-[#292a30] p-4">
          <Link
            to="/app"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-[#292a30] hover:text-white"
          >
            ← Back to NEXUS
          </Link>
        </div>
      </aside>

      {/* Settings content */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">

          <h1 className="mb-8 text-3xl font-black">User Settings</h1>

          {error && (
            <p className="mb-5 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p className="mb-5 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
              {success}
            </p>
          )}

          {activeTab === 'profile' && (
            <section>
              <h2 className="text-xl font-bold">My Profile</h2>
              <p className="mt-1 text-sm text-gray-400">
                Customize how other people see you on NEXUS.
              </p>

              <div className="mt-8 rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">

                {/* Profile picture */}
                <div className="flex items-center gap-5">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0390fc] text-3xl font-bold">
                      {displayName.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold">Profile Picture</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      PNG, JPG, or WebP. Maximum 5 MB.
                    </p>

                    <label className="mt-3 inline-block cursor-pointer rounded-lg bg-[#34353d] px-4 py-2 text-sm font-bold transition hover:bg-[#454650]">
                      {uploadingAvatar ? 'Uploading...' : 'Upload Picture'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadImage(file, 'avatar')
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Profile banner */}
                <div className="mt-8">
                  <h3 className="font-bold">Profile Banner</h3>

                  {profile?.banner_url ? (
                    <img
                      src={profile.banner_url}
                      alt="Profile banner"
                      className="mt-3 h-32 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="mt-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-[#4a4b55] bg-[#17181c] text-sm text-gray-500">
                      No banner uploaded
                    </div>
                  )}

                  <label className="mt-3 inline-block cursor-pointer rounded-lg bg-[#34353d] px-4 py-2 text-sm font-bold transition hover:bg-[#454650]">
                    {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingBanner}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadImage(file, 'banner')
                        e.target.value = ''
                      }}
                    />
                  </label>

                  <p className="mt-2 text-xs text-gray-500">
                    PNG, JPG, or WebP. Maximum 5 MB.
                  </p>
                </div>

                {/* Display name */}
                <div className="mt-8">
                  <label className="font-bold">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={32}
                    className="mt-2 w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum 32 characters.
                  </p>
                </div>

                {/* Bio */}
                <div className="mt-6">
                  <label className="font-bold">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Tell people a little about yourself..."
                    className="mt-2 w-full resize-none rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
                  />
                  <p className="mt-1 text-right text-xs text-gray-500">
                    {bio.length}/1000
                  </p>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="mt-6 rounded-lg bg-[#0390fc] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#168ff0] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'account' && (
            <section>
              <h2 className="text-xl font-bold">My Account</h2>
              <p className="mt-1 text-sm text-gray-400">
                Manage your NEXUS account information.
              </p>

              <div className="mt-8 rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">
                <label className="font-bold">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={24}
                  className="mt-2 w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-white outline-none focus:border-[#0390fc]"
                />
                <p className="mt-1 text-xs text-gray-500">
                  3–24 letters or numbers. Usernames must be unique.
                </p>

                <div className="mt-6">
                  <label className="font-bold">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="mt-2 w-full rounded-lg border border-[#34353d] bg-[#17181c] px-4 py-3 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email changes will be implemented separately.
                  </p>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="mt-6 rounded-lg bg-[#0390fc] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#168ff0] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </section>
          )}

          {activeTab === 'security' && (
            <section>
              <h2 className="text-xl font-bold">Security</h2>
              <p className="mt-1 text-sm text-gray-400">
                Keep your account secure.
              </p>

              <div className="mt-8 rounded-xl border border-[#34353d] bg-[#1e1f24] p-6">
                <h3 className="font-bold">Change Password</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Password management is coming soon.
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <h3 className="font-bold text-red-400">Log Out</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Sign out of your NEXUS account on this device.
                </p>
                <button
                  onClick={handleLogout}
                  className="mt-4 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
                >
                  Log Out
                </button>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}

export default Settings
