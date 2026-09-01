export type SessionHydrationRequest = Readonly<{
  generation: number;
  userId: string;
}>;

export type SessionHydrationGuard = Readonly<{
  begin: (userId: string) => SessionHydrationRequest;
  invalidate: () => void;
  isCurrent: (
    request: SessionHydrationRequest,
    currentSessionUserId: string | null,
  ) => boolean;
}>;

export function createSessionHydrationGuard(): SessionHydrationGuard {
  let generation = 0;

  return {
    begin(userId) {
      generation += 1;
      return { generation, userId };
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(request, currentSessionUserId) {
      return (
        request.generation === generation &&
        request.userId === currentSessionUserId
      );
    },
  };
}
