
export {}

declare global {
  interface Window {
    nexusDesktop?: {
      openBrowserAuth: (url: string) => Promise<boolean>
      onAuthCallback: (callback: (url: string) => void) => () => void
    }
  }
}
