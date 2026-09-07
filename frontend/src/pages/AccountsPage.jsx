import { useCallback, useMemo } from 'react';
import {
  Badge,
  Button,
  Panel,
  PanelFooter,
  PanelHeader,
} from '../components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  ForbiddenState,
  SkeletonTable,
} from '../components/ui/states.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { endpoints } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isAdmin, roleLabel } from '../lib/domain.js';
import { formatDateTime, formatRelative, initials } from '../lib/format.js';

/**
 * Panel hesapları — GET /api/admin/users (yalnızca Admin).
 *
 * Bu uç nokta backend'de mevcuttu ancak eski arayüzde hiç kullanılmıyordu.
 * Salt okunurdur: backend kullanıcı oluşturma/düzenleme uç noktası sunmaz,
 * bu nedenle burada da böyle bir eylem gösterilmez.
 */
export function AccountsPage() {
  const { role, username: currentUsername } = useAuth();
  const admin = isAdmin(role);

  const accounts = useApiResource(
    useCallback((token, signal) => endpoints.adminUsers(token, signal), []),
    { enabled: admin }
  );

  const rows = useMemo(
    () => (Array.isArray(accounts.data) ? accounts.data : []),
    [accounts.data]
  );

  if (!admin) {
    return (
      <div className="page page--narrow">
        <header className="page-header">
          <div className="page-header__text">
            <h1 className="page-header__title">
              Panel hesapları
            </h1>
          </div>
        </header>
        <Panel>
          <ForbiddenState message="Yönetici rolü gerekir" />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">
            Panel hesapları
          </h1>
        </div>
        <div className="page-header__actions">
          <Button icon="refresh" onClick={accounts.refresh} loading={accounts.isRefreshing}>
            Yenile
          </Button>
        </div>
      </header>

      <Panel flush>
        <PanelHeader
          title="Hesaplar"
          subtitle={rows.length > 0 ? `${rows.length} kayıt` : undefined}
        />
        <AsyncBoundary
          resource={accounts}
          isEmpty={rows.length === 0}
          skeleton={<SkeletonTable rows={4} columns={4} />}
          empty={
            <EmptyState
              icon="users"
              title="Kayıtlı hesap yok"
            />
          }
        >
          {() => (
            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">Panel kullanıcı hesapları</caption>
                <thead>
                  <tr>
                    <th scope="col">Kullanıcı</th>
                    <th scope="col">E-posta</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Oluşturulma</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <span className="row" style={{ gap: 'var(--sp-2)' }}>
                          <span className="user-chip__avatar" aria-hidden="true">
                            {initials(account.username)}
                          </span>
                          <span className="table__cell-strong">{account.username}</span>
                          {account.username === currentUsername && (
                            <Badge tone="accent">Siz</Badge>
                          )}
                        </span>
                      </td>
                      <td className="truncate" style={{ maxWidth: 240 }}>
                        {account.email || '—'}
                      </td>
                      <td>
                        <Badge tone={isAdmin(account.role) ? 'warn' : 'neutral'}>
                          {roleLabel(account.role)}
                        </Badge>
                      </td>
                      <td>
                        <span
                          className="mono table__cell-muted"
                          title={formatDateTime(account.createdAt)}
                        >
                          {formatRelative(account.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncBoundary>
        <PanelFooter>
          <span>
            Kaynak:{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>GET /api/admin/users</code>
          </span>
        </PanelFooter>
      </Panel>
    </div>
  );
}

export default AccountsPage;
