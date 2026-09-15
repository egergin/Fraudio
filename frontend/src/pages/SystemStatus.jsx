import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { tr } from '../i18n/tr.js';
import { useRealtimeEvents } from '../realtime.jsx';
import { BackToDashboard } from '../components/Shell.jsx';
import { HealthBadge, StateBox } from '../components/ui.jsx';

const SERVICE_NAMES = { postgres: 'PostgreSQL', redis: 'Redis', rabbitmq: 'RabbitMQ' };

export function SystemStatus() {
  const { role } = useAuth();
  const [health, setHealth] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.health();
      setHealth(data);
      setState('ready');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useRealtimeEvents(
    useCallback((msg) => {
      if (msg.event === 'system.status') {
        setHealth({ status: msg.status, dependencies: msg.dependencies });
        setState('ready');
      }
    }, []),
  );

  if (role !== 'Admin') {
    return (
      <>
        <p>
          <BackToDashboard />
        </p>
        <div className="card">
          <StateBox kind="error">Bu bölüm yalnızca yöneticiler içindir.</StateBox>
        </div>
      </>
    );
  }

  return (
    <>
      

      {state === 'loading' && <StateBox kind="loading" />}
      {state === 'error' && <StateBox kind="error" onRetry={load}>{error}</StateBox>}

      {state === 'ready' && health && (
        <section className="card" aria-labelledby="sistem-baslik">
          <h2 id="sistem-baslik" style={{ marginBottom: 4 }}>{tr.dashboard.systemTitle}</h2>
          <ul className="health-grid">
            {Object.entries(health.dependencies).map(([name, depState]) => (
              <li key={name}>
                <span>{SERVICE_NAMES[name] ?? name}</span>
                <HealthBadge state={depState} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
