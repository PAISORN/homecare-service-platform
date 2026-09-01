import { createContext, useContext, useMemo, useState } from 'react';

type AuthDraftContextValue = Readonly<{
  phone: string;
  setPhone: (phone: string) => void;
  clearPhone: () => void;
}>;

const AuthDraftContext = createContext<AuthDraftContextValue | null>(null);

export function AuthDraftProvider({ children }: React.PropsWithChildren) {
  const [phone, setPhone] = useState('');
  const value = useMemo(
    () => ({ phone, setPhone, clearPhone: () => setPhone('') }),
    [phone],
  );

  return (
    <AuthDraftContext.Provider value={value}>
      {children}
    </AuthDraftContext.Provider>
  );
}

export function useAuthDraft(): AuthDraftContextValue {
  const context = useContext(AuthDraftContext);
  if (!context) throw new Error('AuthDraftProvider is missing');
  return context;
}
