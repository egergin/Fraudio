import Icon from '../ui/Icon.jsx';
import { ConnectionState } from '../../hooks/useLiveStream.js';

const LABEL = {
  [ConnectionState.CONNECTED]: 'Canlı',
  [ConnectionState.CONNECTING]: 'Bağlanıyor',
  [ConnectionState.RECONNECTING]: 'Yeniden bağlanıyor',
  [ConnectionState.DISCONNECTED]: 'Bağlantı yok',
};

const TITLE = {
  [ConnectionState.CONNECTED]: 'Gerçek zamanlı akış bağlı — olaylar anında görüntüleniyor.',
  [ConnectionState.CONNECTING]: 'Gerçek zamanlı akışa bağlanılıyor.',
  [ConnectionState.RECONNECTING]: 'Bağlantı koptu, otomatik olarak yeniden denenecek.',
  [ConnectionState.DISCONNECTED]:
    'Gerçek zamanlı akış bağlı değil. Tablo verileri hâlâ API üzerinden okunabilir.',
};

/**
 * WebSocket bağlantı durumu göstergesi.
 * Bağlantı kesikken tıklanabilir hale gelir ve yeniden bağlanmayı tetikler.
 */
export function ConnectionIndicator({ state, onReconnect }) {
  const label = LABEL[state] ?? 'Bilinmiyor';
  const isDown = state === ConnectionState.DISCONNECTED;

  const content = (
    <>
      <span className="conn__dot" aria-hidden="true" />
      <span className="conn__label">{label}</span>
    </>
  );

  if (isDown && onReconnect) {
    return (
      <button
        type="button"
        className="conn"
        data-state={state}
        onClick={onReconnect}
        title={`${TITLE[state]} Yeniden bağlanmak için tıklayın.`}
      >
        {content}
        <Icon name="refresh" size={12} />
        <span className="visually-hidden">Yeniden bağlan</span>
      </button>
    );
  }

  return (
    <span className="conn" data-state={state} title={TITLE[state]} role="status">
      {content}
      <span className="visually-hidden">Gerçek zamanlı akış durumu: {label}</span>
    </span>
  );
}

export default ConnectionIndicator;
