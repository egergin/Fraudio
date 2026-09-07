import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/legacy/Icon.jsx';
import {
  Button,
  CopyableId,
  Panel,
  PanelBody,
  PanelHeader,
} from '../components/legacy/primitives.jsx';
import { ForbiddenState } from '../components/legacy/states.jsx';
import { endpoints, ErrorKind } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isAdmin } from '../lib/domain.js';
import { formatCurrency } from '../lib/format.js';

/**
 * İşlem gönderme — POST /api/transactions (yalnızca Admin).
 *
 * Bu uç nokta backend'de mevcuttu ancak arayüzü yoktu. Kural motorunu
 * doğrulamak ve demo trafiği üretmek için operatöre açık bir form sağlar.
 * Sözleşme birebir korunur: { userId, amount, location } → 202 Accepted.
 */
export function SubmitTransactionPage() {
  const { token, role } = useAuth();
  const admin = isAdmin(role);

  const [form, setForm] = useState({ userId: '', amount: '', location: '' });
  const [status, setStatus] = useState('idle'); // idle | pending | success | error
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const [touched, setTouched] = useState(false);

  if (!admin) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">
              İşlem gönder
            </h1>
          </div>
        </header>
        <Panel>
          <ForbiddenState message="Yönetici rolü gerekir" />
        </Panel>
      </div>
    );
  }

  const amountValue = Number(form.amount);
  const errors = {
    userId: !form.userId.trim() ? 'Kullanıcı kimliği gereklidir.' : null,
    amount:
      !form.amount.trim()
        ? 'Tutar gereklidir.'
        : !Number.isFinite(amountValue) || amountValue <= 0
          ? 'Tutar sıfırdan büyük bir sayı olmalıdır.'
          : null,
    location: !form.location.trim() ? 'Konum gereklidir.' : null,
  };

  const isValid = !errors.userId && !errors.amount && !errors.location;
  const isPending = status === 'pending';

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!isValid || isPending) return;

    setStatus('pending');
    setError(null);

    try {
      const { data } = await endpoints.submitTransaction(
        {
          userId: form.userId.trim(),
          amount: amountValue,
          location: form.location.trim(),
        },
        token
      );

      setStatus('success');
      setAccepted((prev) =>
        [
          {
            transactionId: data?.transactionId,
            userId: form.userId.trim(),
            amount: amountValue,
            location: form.location.trim(),
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 8)
      );
      // Kullanıcı kimliği ve konum korunur; art arda gönderimi kolaylaştırır.
      setForm((prev) => ({ ...prev, amount: '' }));
      setTouched(false);
    } catch (err) {
      setStatus('error');
      setError(err);
    }
  };

  const errorMessage =
    error?.kind === ErrorKind.VALIDATION
      ? error.message
      : error?.kind === ErrorKind.FORBIDDEN
        ? 'Bu işlem için yetkiniz bulunmuyor.'
        : error?.kind === ErrorKind.NETWORK
          ? 'Sunucuya ulaşılamadı. İşlem gönderilemedi.'
          : error
            ? 'İşlem gönderilemedi. Lütfen yeniden deneyin.'
            : null;

  return (
    <div className="page page--narrow">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">
            İşlem gönder
          </h1>
        </div>
      </header>

      <div className="grid grid--halves">
        <Panel>
          <PanelHeader title="Yeni işlem" />
          <PanelBody>
            <form className="stack" onSubmit={handleSubmit} noValidate>
              {errorMessage && (
                <div className="notice notice--danger" role="alert">
                  <Icon name="warning" size={13} className="notice__icon" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="field">
                <label className="field__label" htmlFor="tx-user">
                  Kullanıcı kimliği
                </label>
                <input
                  id="tx-user"
                  className="input input--mono"
                  type="text"
                  placeholder="customer-100"
                  value={form.userId}
                  disabled={isPending}
                  aria-invalid={touched && errors.userId ? 'true' : undefined}
                  onChange={update('userId')}
                />
                {touched && errors.userId && (
                  <span className="field__error">
                    <Icon name="warning" size={12} />
                    {errors.userId}
                  </span>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="tx-amount">
                  Tutar (TRY)
                </label>
                <input
                  id="tx-amount"
                  className="input input--mono"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="1250.50"
                  value={form.amount}
                  disabled={isPending}
                  aria-invalid={touched && errors.amount ? 'true' : undefined}
                  onChange={update('amount')}
                />
                {touched && errors.amount ? (
                  <span className="field__error">
                    <Icon name="warning" size={12} />
                    {errors.amount}
                  </span>
                ) : (
                  <span className="field__hint">
                    Kullanıcının 24 saatlik ortalamasının 3 katını aşan tutarlar kural
                    ihlali tetikler.
                  </span>
                )}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="tx-location">
                  Konum
                </label>
                <input
                  id="tx-location"
                  className="input"
                  type="text"
                  placeholder="Istanbul"
                  value={form.location}
                  disabled={isPending}
                  aria-invalid={touched && errors.location ? 'true' : undefined}
                  onChange={update('location')}
                />
                {touched && errors.location ? (
                  <span className="field__error">
                    <Icon name="warning" size={12} />
                    {errors.location}
                  </span>
                ) : (
                  <span className="field__hint">
                    Şehir adı coğrafi kodlama servisiyle koordinata çevrilir.
                  </span>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                icon="send"
                loading={isPending}
                disabled={isPending}
                block
              >
                {isPending ? 'Gönderiliyor…' : 'İşlemi gönder'}
              </Button>
            </form>
          </PanelBody>
        </Panel>

        {/* Gönderim sonuçları */}
        <Panel flush>
          <PanelHeader
            title="Kabul edilen işlemler"
            subtitle={accepted.length > 0 ? `${accepted.length} kayıt` : undefined}
          />
          {accepted.length === 0 ? (
            <div className="state state--compact">
              <p className="state__title">Gönderim yok</p>
            </div>
          ) : (
            <div className="feed">
              {accepted.map((item) => (
                <div className="feed__item" key={item.transactionId ?? item.at}>
                  <span className="sev-bar" data-sev="none" style={{ height: 22 }} />
                  <span className="badge badge--accent">202</span>
                  <span className="feed__body">
                    <span className="feed__primary">
                      <span className="mono truncate" style={{ fontSize: 'var(--text-xs)' }}>
                        {item.userId}
                      </span>
                    </span>
                    <span className="feed__secondary">
                      <CopyableId value={item.transactionId} />
                    </span>
                  </span>
                  <span className="feed__amount">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="panel__footer">
            <span>Kabul edildi ≠ onaylandı</span>
            <Link to="/stream" className="btn btn--ghost btn--sm">
              Canlı akışı izle
              <Icon name="chevronRight" size={12} />
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default SubmitTransactionPage;
