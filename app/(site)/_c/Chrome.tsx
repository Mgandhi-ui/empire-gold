// Header and footer for every public page. The MahaRERA block sits top-right, larger than any phone number (Order 46C/2025).
import Link from 'next/link';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { P } from '@/lib/project';

const hasQr = existsSync(join(process.cwd(), 'public', 'img', 'maharera-qr.png'));

export function Header() {
  return (
    <header className="hdr">
      <div className="wrap">
        <Link className="logo" href="/">Empire Gold</Link>
        <nav className="nav" aria-label="Sections">
          <Link href="/#homes">Homes</Link><Link href="/#floors">Floors</Link><Link href="/#built">Specifications</Link>
          <Link href="/#location">Location</Link><Link href="/partners">Brokers</Link><Link href="/#visit">Visit</Link>
        </nav>
        <div className="rera" aria-label={`MahaRERA registration ${P.rera}`}>
          <div><small>MahaRERA REG. NO.</small><b>{P.rera}</b><span>{P.reraSite}</span></div>
          <div className="qr">{hasQr ? <img src="/img/maharera-qr.png" alt="MahaRERA QR code" /> : <>MahaRERA<br />QR</>}</div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="r">MahaRERA Registration No. {P.rera} · {P.reraSite}</div>
        <p>Empire Gold, {P.address} · {P.phones.join(' · ')}</p>
        <p>Promoter: {P.developer}. This website is for information only and is not an offer, an invitation to offer or a contract. Areas are MahaRERA carpet areas. Images and layouts are artistic impressions; furniture, appliances and décor are not included. The fitness centre and 15th-floor terraces are common amenities, not part of any flat. Specifications and availability may change; the registered agreement for sale prevails.</p>
        <p><Link href="/privacy">Privacy</Link> &nbsp; <Link href="/partners">Channel partners</Link> &nbsp; <a href="https://back.empiregoldmazgaon.com/login">Partner and buyer login</a></p>
      </div>
    </footer>
  );
}
