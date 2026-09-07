import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { FormField, Input, Notice } from '@/components/ui/input.jsx';
import { Panel, Section, SectionHeader, SectionNote } from '@/components/ui/primitives.jsx';
import { CopyableId } from '@/components/ui/data-bits.jsx';
import { ForbiddenState } from '@/components/ui/states.jsx';
import { endpoints, ErrorKind } from '@/lib/api.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { isAdmin } from '@/lib/domain.js';
import { formatCurrency, formatRelative } from '@/lib/format.js';

/**
 * İşlem gönderme — POST /api/transactions (yalnızca Admin).
 *
 * Kural motorunu doğrulamak ve demo trafiği üretmek içindir.
 * Sözleşme birebir korunur: { userId, amount, location } → 202 Accepted.
 */
export function SubmitTransactionPage() {
  const { token, role } = useAuth();
  const admin = isAdmin(role);

  const [form, setForm] = useState({ userId: '', amount: '', location: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const [touched, setTouched] = useState(false);

  if (!admin) return <ForbiddenState message="Yönetici rolü gerekir" />;

  const amountValue = Number(form.amount);
  const errors = {
    userId: !form.userId.trim() ? 'Zorunlu' : null,
    amount: !form.amount.trim()
      ? 'Zorunlu'
      : !Number.isFinite(amountValue) || amountValue <= 0
        ? "Sıfırdan büyük olmalı"
        : null,
    location: !form.location.trim() ? 'Zorunlu' : null,
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
      // Kullanıcı ve konum korunur; art arda gönderimi kolaylaştırır.
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
        ? 'Yetkiniz yok'
        : error?.kind === ErrorKind.NETWORK
          ? 'Sunucuya ulaşılamıyor'
          : error
            ? 'Gönderilemedi'
            : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Form gerçekten yükseltilmiş bir yüzey — burada Panel yerinde. */}
      <Panel className="h-fit p-5">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {errorMessage && <Notice tone="danger">{errorMessage}</Notice>}
          {status === 'success' && !errorMessage && (
            <Notice tone="ok">Kabul edildi · 202</Notice>
          )}

          <FormField label="Kullanıcı kimliği" required error={touched ? errors.userId : null}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                value={form.userId}
                onChange={update('userId')}
                disabled={isPending}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="customer-100"
                autoComplete="off"
                spellCheck="false"
                className="font-mono"
              />
            )}
          </FormField>

          <FormField label="Tutar" required error={touched ? errors.amount : null}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={update('amount')}
                disabled={isPending}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="1500.00"
                className="font-mono tnum"
              />
            )}
          </FormField>

          <FormField label="Konum" required error={touched ? errors.location : null}>
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                value={form.location}
                onChange={update('location')}
                disabled={isPending}
                invalid={invalid}
                aria-describedby={describedBy}
                placeholder="Istanbul"
                autoComplete="off"
              />
            )}
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-1 w-full"
            loading={isPending}
            disabled={isPending}
          >
            {isPending ? 'Gönderiliyor…' : 'Gönder'}
          </Button>
        </form>
      </Panel>

      <Section>
        <SectionHeader title="Bu oturumda gönderilenler" count={accepted.length || undefined} />

        {accepted.length === 0 ? (
          <p className="py-6 text-sm text-fg-muted">Gönderim yok</p>
        ) : (
          <ul className="flex flex-col">
            {accepted.map((item) => (
              <li
                key={item.transactionId ?? item.at}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-2.5"
              >
                <span className="font-mono text-sm font-semibold tnum text-fg">
                  {formatCurrency(item.amount)}
                </span>
                <span className="font-mono text-xs text-fg-secondary">{item.userId}</span>
                <span className="text-2xs text-fg-muted">{item.location}</span>
                <span className="ml-auto flex items-center gap-3">
                  <CopyableId value={item.transactionId} />
                  <span className="font-mono text-2xs text-fg-subtle">
                    {formatRelative(item.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <SectionNote>Sonuç canlı akışta görünür</SectionNote>
      </Section>
    </div>
  );
}

export default SubmitTransactionPage;
