
from pathlib import Path
import re

path = Path("src/pages/AppHome.tsx")
source = path.read_text()

# Create a backup.
backup = Path("src/pages/AppHome.backup.tsx")
backup.write_text(source)

# Remove shared type definitions from AppHome.
type_names = [
    "Profile",
    "Friendship",
    "FriendEntry",
    "SettingsProfile",
    "Conversation",
    "DmMessage",
    "ConversationEntry",
]

for name in type_names:
    pattern = rf"type {name} = \{{.*?\n\}}\n\n?"
    source, count = re.subn(pattern, "", source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Could not safely find type {name}")

# Remove the old nested Avatar component.
source, count = re.subn(
    r"\n  function Avatar\(\{.*?\n  \}\n\n(?=  function FriendRow)",
    "\n",
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Could not safely find old Avatar component")

# Remove the old nested FriendRow component.
source, count = re.subn(
    r"\n  function FriendRow\(\{.*?\n  \}\n\n(?=  if \(loadingProfile\))",
    "\n",
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("Could not safely find old FriendRow component")

# Update the FriendRow usage.
old_usage = "<FriendRow key={entry.friendship.id} entry={entry} />"

new_usage = """<FriendRow
                          key={entry.friendship.id}
                          entry={entry}
                          requestLoading={requestLoading}
                          onOpenConversation={openConversation}
                          onUnfriend={unfriend}
                        />"""

if source.count(old_usage) != 1:
    raise RuntimeError("Could not safely find FriendRow usage")

source = source.replace(old_usage, new_usage)

# Replace imports.
import_pattern = (
    r"^import FriendRow.*?from '../components/FriendRow'\n"
    r"import Avatar.*?from '../components/Avatar'\n"
    r"import \{ useEffect, useState \} from 'react'\n"
    r"import \{ Link \} from 'react-router-dom'\n"
    r"import \{ supabase \} from '../lib/supabase'"
)

new_imports = """import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

import Avatar from '../components/Avatar'
import FriendRow from '../components/FriendRow'

import type {
  Profile,
  Friendship,
  FriendEntry,
  SettingsProfile,
  Conversation,
  DmMessage,
  ConversationEntry,
} from '../types'"""

source, count = re.subn(
    import_pattern,
    lambda _: new_imports,
    source,
    count=1,
    flags=re.M | re.S,
)

if count != 1:
    raise RuntimeError("Could not safely update imports")

path.write_text(source)

print("AppHome.tsx updated successfully!")
print(f"Backup saved as {backup}")
