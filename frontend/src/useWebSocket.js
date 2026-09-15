import { useEffect, useRef, useState } from 'react';
import { WS_URL } from './api.js';

export const WS_CONNECTED = 'connected';
export const WS_RECONNECTING = 'reconnecting';
export const WS_DISCONNECTED = 'disconnected';

export function useWebSocket(onMessage) {
  const [status, setStatus] = useState(WS_DISCONNECTED);
  const [attempt, setAttempt] = useState(0);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    let socket = null;
    let timer = null;
    let tries = 0;

    function connect() {
      if (stopRef.current) return;
      const token = localStorage.getItem('token');
      if (!token) {
        setStatus(WS_DISCONNECTED);
        return;
      }
      setStatus(tries === 0 ? WS_DISCONNECTED : WS_RECONNECTING);
      socket = new WebSocket(`${WS_URL}?access_token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        tries = 0;
        setAttempt(0);
        setStatus(WS_CONNECTED);
      };
      socket.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data));
        } catch {
        }
      };
      const scheduleReconnect = () => {
        if (stopRef.current || !localStorage.getItem('token')) {
          setStatus(WS_DISCONNECTED);
          return;
        }
        tries += 1;
        setAttempt(tries);
        setStatus(WS_RECONNECTING);
        timer = setTimeout(connect, Math.min(1000 * 2 ** (tries - 1), 10000));
      };
      socket.onclose = scheduleReconnect;
      socket.onerror = () => socket?.close();
    }

    connect();
    return () => {
      stopRef.current = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { status, attempt };
}
