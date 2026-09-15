import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket.js';

const StatusContext = createContext({ status: 'disconnected', attempt: 0 });
const HandlersContext = createContext(new Set());
const NotificationsContext = createContext({ items: [], unread: 0 });

const STORAGE_KEY = 'fraudio-notifications';
const STORE_CAP = 20;

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => n && n.transactionId).slice(0, STORE_CAP) : [];
  } catch {
    return [];
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, STORE_CAP)));
  } catch {
  }
}

export function RealtimeBus({ children }) {
  const handlers = useRef(new Set());
  const [notifications, setNotifications] = useState(loadStored);
  const { status, attempt } = useWebSocket((msg) => {
    if (msg.event === 'transaction.suspicious') {
      const item = {
        transactionId: msg.transactionId,
        userId: msg.userId,
        amount: msg.amount,
        city: msg.city,
        occurredAt: msg.occurredAt,
        seen: false,
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.transactionId === item.transactionId)) return prev;
        const next = [item, ...prev].slice(0, STORE_CAP);
        persist(next);
        return next;
      });
    }
    handlers.current.forEach((fn) => {
      try {
        fn(msg);
      } catch {
      }
    });
  });

  const markAllSeen = useCallback(() => {
    setNotifications((prev) => {
      if (prev.every((n) => n.seen)) return prev;
      const next = prev.map((n) => (n.seen ? n : { ...n, seen: true }));
      persist(next);
      return next;
    });
  }, []);
  
  const clearNotifications = useCallback(() => {
    setNotifications((prev) => {
      if (prev.length === 0) return prev;
      persist([]);
      return [];
    });
  }, []);

  const unread = notifications.filter((n) => !n.seen).length;

  return (
    <HandlersContext.Provider value={handlers.current}>
      <StatusContext.Provider value={{ status, attempt }}>
        <NotificationsContext.Provider value={{ items: notifications, unread, markAllSeen, clearNotifications }}>
          {children}
        </NotificationsContext.Provider>
      </StatusContext.Provider>
    </HandlersContext.Provider>
  );
}

export function useRealtimeStatus() {
  const { status, attempt } = useContext(StatusContext);
  return { status, attempt };
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

export function useRealtimeEvents(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  const handlers = useContext(HandlersContext);
  useEffect(() => {
    const fn = (msg) => ref.current(msg);
    handlers.add(fn);
    return () => {
      handlers.delete(fn);
    };
  }, [handlers]);
}
