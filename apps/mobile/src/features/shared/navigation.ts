import type { Href } from 'expo-router';

type BackRouter = Readonly<{
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
}>;

export function goBackOrReplace(router: BackRouter, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
