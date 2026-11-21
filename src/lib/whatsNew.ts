import whatsNewData from '../data/whats-new.json'
import type { WhatsNewRelease } from '../components/WhatsNew'

export type WhatsNewStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'

export type PublishedWhatsNewRelease = WhatsNewRelease & {
  status: 'published'
}

export type WhatsNewReleaseEntry = WhatsNewRelease & {
  status: WhatsNewStatus
}

export type WhatsNewData = {
  releases: WhatsNewReleaseEntry[]
}

const data = whatsNewData as WhatsNewData

export function getPublishedReleases(): PublishedWhatsNewRelease[] {
  return data.releases
    .filter(
      (release): release is PublishedWhatsNewRelease =>
        release.status === 'published',
    )
    .sort(
      (first, second) =>
        second.releaseDate.localeCompare(first.releaseDate),
    )
}

export function getLatestPublishedRelease(): PublishedWhatsNewRelease | null {
  return getPublishedReleases()[0] ?? null
}
