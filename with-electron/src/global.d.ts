// The API that preload.cjs gives the renderer.
import type { AppInfo } from '@manalens/web';

declare global {
  interface Window {
    game: {
      config(): Promise<{ publishableKey: string; endpoint: string; app: AppInfo }>;
      setAnonymousId(anonymousId: string): Promise<{ sessionId?: string; uncleanExit: boolean } | null>;
      simulateCrash(): Promise<void>;
    };
    gameQuit?: () => Promise<void>;
  }
}
export {};
