import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { tr } from '../i18n/tr.js';

export function SubmitTransactionDialog({ onClose }) {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const value = Number(String(amount).replace(',', '.'));
    if (!userId.trim() || !location.trim()) {
      setError(tr.login.required);
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError(tr.submit.invalidAmount);
      return;
    }
    setSending(true);
    try {
      const res = await api.submitTransaction(userId.trim(), value, location.trim());
      setSuccess(tr.submit.success(res.transactionId));
      setUserId('');
      setAmount('');
      setLocation('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="submit-title">{tr.submit.title}</h2>
        <form onSubmit={submit}>
          <label className="field">
            <span>{tr.submit.userId}</span>
            <input
              ref={firstRef}
              className="input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user-123"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>{tr.submit.amount}</span>
            <input
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1250,50"
              inputMode="decimal"
              aria-invalid={error === tr.submit.invalidAmount}
            />
          </label>
          <label className="field">
            <span>{tr.submit.location}</span>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="İstanbul"
              autoComplete="off"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="form-success" role="status">
              {success}
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              {tr.common.cancel}
            </button>
            <button className="btn" type="submit" disabled={sending}>
              {sending ? tr.submit.sending : tr.submit.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
