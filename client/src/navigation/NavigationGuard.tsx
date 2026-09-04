import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useBlocker } from "react-router-dom";

export type NavigationAction = () => void;

interface NavigationGuardRegistration {
  dirty: boolean;
  onBlockedNavigation: (action: NavigationAction) => void;
}

interface NavigationGuardContextValue {
  register: (registration: NavigationGuardRegistration) => () => void;
  requestNavigation: (action: NavigationAction) => void;
  allowNavigation: (action: NavigationAction) => void;
  cancelNavigation: () => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

interface NavigationGuardProviderProps {
  children: ReactNode;
  enableHistoryBlocking?: boolean;
}

interface HistoryNavigationGuardProps {
  registrationRef: React.MutableRefObject<NavigationGuardRegistration | null>;
  allowNextNavigationRef: React.MutableRefObject<boolean>;
  blockedResetRef: React.MutableRefObject<(() => void) | null>;
}

function HistoryNavigationGuard({
  registrationRef,
  allowNextNavigationRef,
  blockedResetRef,
}: HistoryNavigationGuardProps) {
  const shouldBlock = useCallback(() => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      return false;
    }

    return registrationRef.current?.dirty ?? false;
  }, [allowNextNavigationRef, registrationRef]);
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    const registration = registrationRef.current;

    if (registration === null) {
      blocker.reset();
      return;
    }

    blockedResetRef.current = blocker.reset;
    registration.onBlockedNavigation(() => {
      blockedResetRef.current = null;
      blocker.proceed();
    });
  }, [blocker, blockedResetRef, registrationRef]);

  return null;
}

export function NavigationGuardProvider({
  children,
  enableHistoryBlocking = false,
}: NavigationGuardProviderProps) {
  const registrationRef = useRef<NavigationGuardRegistration | null>(null);
  const allowNextNavigationRef = useRef(false);
  const blockedResetRef = useRef<(() => void) | null>(null);

  const register = useCallback((registration: NavigationGuardRegistration): (() => void) => {
    registrationRef.current = registration;

    return () => {
      if (registrationRef.current === registration) {
        registrationRef.current = null;
      }
    };
  }, []);

  const requestNavigation = useCallback((action: NavigationAction): void => {
    const registration = registrationRef.current;

    if (registration?.dirty) {
      registration.onBlockedNavigation(() => {
        allowNextNavigationRef.current = true;
        action();
      });
      return;
    }

    action();
  }, []);

  const allowNavigation = useCallback((action: NavigationAction): void => {
    allowNextNavigationRef.current = true;
    action();
  }, []);

  const cancelNavigation = useCallback((): void => {
    blockedResetRef.current?.();
    blockedResetRef.current = null;
  }, []);

  return (
    <NavigationGuardContext.Provider
      value={{ register, requestNavigation, allowNavigation, cancelNavigation }}
    >
      {enableHistoryBlocking ? (
        <HistoryNavigationGuard
          registrationRef={registrationRef}
          allowNextNavigationRef={allowNextNavigationRef}
          blockedResetRef={blockedResetRef}
        />
      ) : null}
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard(): NavigationGuardContextValue {
  const value = useContext(NavigationGuardContext);

  if (value === null) {
    throw new Error("useNavigationGuard must be used inside NavigationGuardProvider.");
  }

  return value;
}
