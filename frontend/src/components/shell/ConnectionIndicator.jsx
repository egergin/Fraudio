import { Button } from '@/components/ui/button.jsx';
import { StatusDot } from '@/components/ui/primitives.jsx';
import { ConnectionState } from '@/hooks/useLiveStream.js';

/** Bağlantı durumu — tek kelime, gerektiğinde tek eylem. */
const STATE_META = {
  [ConnectionState.CONNECTED]: { tone: 'live', label: 'Canlı', pulse: true },
  [ConnectionState.CONNECTING]: { tone: 'idle', label: 'Bağlanıyor' },
  [ConnectionState.RECONNECTING]: { tone: 'warn', label: 'Yeniden bağlanıyor' },
  [ConnectionState.DISCONNECTED]: { tone: 'critical', label: 'Bağlı değil' },
};

export function ConnectionIndicator({ state, onReconnect }) {
  const meta = STATE_META[state] ?? STATE_META[ConnectionState.DISCONNECTED];

  return (
    <div className="flex items-center gap-2">
      <StatusDot tone={meta.tone} label={meta.label} pulse={meta.pulse} />
      {state === ConnectionState.DISCONNECTED && onReconnect && (
        <Button variant="ghost" size="sm" onClick={onReconnect}>
          Bağlan
        </Button>
      )}
    </div>
  );
}

export default ConnectionIndicator;
