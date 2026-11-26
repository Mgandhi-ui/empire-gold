import type { Metadata } from 'next';
import Link from 'next/link';
import './office.css';
import { currentUser, isStaff } from '@/lib/auth';

export const metadata: Metadata = { title: 'Empire Gold · Back office', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser().catch(() => null);
  return (
    <html lang="en-IN">
      <body>
        {u && (
          <header className="top">
            <div className="brand">Empire <span>Gold</span></div>
            <nav aria-label="Back office">
              {isStaff(u) && <>
                <Link href="/admin">Dashboard</Link><Link href="/admin/leads">Leads</Link><Link href="/admin/inventory">Inventory</Link>
                <Link href="/admin/bookings">Bookings</Link><Link href="/admin/customers">Buyers</Link><Link href="/admin/partners">Brokers</Link>
                <Link href="/admin/prospects">Broker prospects</Link><Link href="/admin/updates">Site updates</Link>
                {u.role === 'admin' && <Link href="/admin/settings">Settings</Link>}
              </>}
              {u.role === 'partner' && <><Link href="/partner">My sales</Link><Link href="/partner#register">Register a client</Link></>}
              {u.role === 'customer' && <Link href="/my">My home</Link>}
            </nav>
            <div className="me">{u.name}<a href="/logout">Sign out</a></div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
