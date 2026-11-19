export {}

declare global {
  interface Window {
    nexusDesktop?: {
      openBrowserAuth: (url: string) => Promise<boolean>

      setWindowMode: (mode: 'welcome' | 'app') => Promise<boolean>

      onAuthCallback: (callback: (url: string) => void) => () => void
    }
  }
}
