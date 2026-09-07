import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildWebSocketUrl } from '../lib/api.js';

/**
 * Canlı işlem akışı — mevcut WebSocket davranışını korur.
 *
 * Backend olayları (Program.cs / TransactionWorker.cs):
 *   transaction.received   → { transactionId, userId, amount, city, status, occurredAt }
 *   transaction.approved   → + triggeredRules
 *   transaction.suspicious → + triggeredRules
 *
 * Korunan davranış: bağlantı kesilince yeniden bağlanma, olay birleştirme
 * (aynı transactionId güncellenir), şüpheli olayların uyarı listesine eklenmesi.
 *
 * İyileştirmeler: üstel geri çekilme, açık bağlantı durumu makinesi,
 * reducer ile öngörülebilir olay işleme.
 */

const MAX_EVENTS = 60;
const MAX_ALERTS = 40;
const BASE_DELAY = 1000;
const MAX_DELAY = 15000;

export const ConnectionState = Object.freeze({
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
});

const initialState = {
  connection: ConnectionState.DISCONNECTED,
  events: [],
  liveAlerts: [],
  totalReceived: 0,
  totalSuspicious: 0,
  totalApproved: 0,
  lastEventAt: null,
  connectedSince: null,
};

/** Aynı işlem kimliğine sahip olayı günceller, yoksa başa ekler. */
function upsert(list, payload, limit) {
  const index = list.findIndex((x) => x.transactionId === payload.transactionId);
  if (index === -1) {
    return [{ ...payload, _receivedAt: Date.now() }, ...list].slice(0, limit);
  }
  const next = list.slice();
  next[index] = { ...next[index], ...payload };
  return next;
}

function reducer(state, action) {
  switch (action.type) {
    case 'connection':
      return {
        ...state,
        connection: action.state,
        connectedSince:
          action.state === ConnectionState.CONNECTED
            ? state.connectedSince ?? Date.now()
            : action.state === ConnectionState.DISCONNECTED
              ? null
              : state.connectedSince,
      };

    case 'event': {
      const { payload, eventType } = action;
      const events = upsert(state.events, payload, MAX_EVENTS);

      const base = {
        ...state,
        events,
        lastEventAt: Date.now(),
      };

      if (eventType === 'transaction.received') {
        return { ...base, totalReceived: state.totalReceived + 1 };
      }

      if (eventType === 'transaction.approved') {
        return { ...base, totalApproved: state.totalApproved + 1 };
      }

      if (eventType === 'transaction.suspicious') {
        return {
          ...base,
          totalSuspicious: state.totalSuspicious + 1,
          liveAlerts: upsert(state.liveAlerts, payload, MAX_ALERTS),
        };
      }

      return base;
    }

    case 'reset':
      return initialState;

    default:
      return state;
  }
}

export function useLiveStream(token) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const closedByUsRef = useRef(false);

  const teardown = useCallback(() => {
    closedByUsRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
  }, []);

  useEffect(() => {
    if (!token) {
      dispatch({ type: 'reset' });
      return undefined;
    }

    closedByUsRef.current = false;
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      dispatch({
        type: 'connection',
        state: attemptRef.current === 0 ? ConnectionState.CONNECTING : ConnectionState.RECONNECTING,
      });

      let socket;
      try {
        socket = new WebSocket(buildWebSocketUrl(token));
      } catch {
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        attemptRef.current = 0;
        dispatch({ type: 'connection', state: ConnectionState.CONNECTED });
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.eventType) return;
          dispatch({ type: 'event', eventType: payload.eventType, payload });
        } catch {
          /* biçimsiz mesajlar sessizce yok sayılır */
        }
      };

      socket.onerror = () => {
        /* onclose her durumda tetiklenir; yeniden bağlanma orada yönetilir */
      };

      socket.onclose = () => {
        if (disposed || closedByUsRef.current) return;
        dispatch({ type: 'connection', state: ConnectionState.DISCONNECTED });
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (disposed || closedByUsRef.current) return;
      const attempt = attemptRef.current++;
      // Üstel geri çekilme + jitter — sunucuyu yeniden bağlanma fırtınasına boğmaz.
      const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      const jitter = Math.random() * 300;
      timerRef.current = setTimeout(connect, delay + jitter);
    };

    connect();

    return () => {
      disposed = true;
      teardown();
    };
  }, [token, teardown]);

  /** Kullanıcı tetikli anında yeniden bağlanma. */
  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    if (timerRef.current) clearTimeout(timerRef.current);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) return;
    // Mevcut soketi kapatmak onclose → scheduleReconnect zincirini tetikler.
    if (socket) socket.close();
  }, []);

  return useMemo(
    () => ({
      ...state,
      isConnected: state.connection === ConnectionState.CONNECTED,
      reconnect,
    }),
    [state, reconnect]
  );
}
