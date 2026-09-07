import { useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Section, SectionHeader, SectionNote } from '@/components/ui/primitives.jsx';
import {
  AsyncBoundary,
  EmptyState,
  ForbiddenState,
  SkeletonTable,
} from '@/components/ui/states.jsx';
import { useApiResource } from '@/hooks/useApiResource.js';
import { endpoints } from '@/lib/api.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { isAdmin, roleLabel } from '@/lib/domain.js';
import { formatDateTime, formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils.js';

/**
 * Panel hesapları — GET /api/admin/users (yalnızca Admin).
 *
 * Salt okunur: backend kullanıcı oluşturma/düzenleme uç noktası sunmaz,
 * bu yüzden burada da böyle bir eylem gösterilmez.
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

  if (!admin) return <ForbiddenState message="Yönetici rolü gerekir" />;

  return (
    <Section>
      <SectionHeader
        title="Hesaplar"
        count={rows.length || undefined}
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={accounts.refresh}
            loading={accounts.isRefreshing}
            aria-label="Yenile"
          >
            {!accounts.isRefreshing && <RefreshCw />}
          </Button>
        }
      />

      <AsyncBoundary
        resource={accounts}
        isEmpty={rows.length === 0}
        skeleton={<SkeletonTable rows={4} columns={4} />}
        empty={<EmptyState title="Hesap yok" />}
      >
        {() => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Panel kullanıcı hesapları</caption>
              <thead>
                <tr className="border-b border-line-strong">
                  {['Kullanıcı', 'E-posta', 'Rol', 'Oluşturulma'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 text-left text-3xs font-semibold uppercase tracking-[0.08em] text-fg-subtle"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((account) => (
                  <tr key={account.id} className="border-b border-line">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="text-fg">{account.username}</span>
                        {account.username === currentUsername && (
                          <span className="text-2xs text-fg-subtle">siz</span>
                        )}
                      </span>
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-fg-secondary">
                      {account.email || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'text-xs',
                          isAdmin(account.role) ? 'text-warn-fg' : 'text-fg-secondary'
                        )}
                      >
                        {roleLabel(account.role)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="font-mono text-2xs text-fg-muted"
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

      <SectionNote>
        <code className="font-mono">GET /api/admin/users</code> · salt okunur
      </SectionNote>
    </Section>
  );
}

export default AccountsPage;
