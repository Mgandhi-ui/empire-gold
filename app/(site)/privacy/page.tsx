import type { Metadata } from 'next';
import { Header, Footer } from '../_c/Chrome';
import { P } from '@/lib/project';

export const metadata: Metadata = { title: 'Privacy' };

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="band"><div className="wrap" style={{ maxWidth: 760 }}>
        <h2>Privacy</h2>
        <div style={{ display: 'grid', gap: 14, marginTop: 20, color: 'var(--soft)' }}>
          <p>When you send an enquiry or a partner application, we keep the details you typed (name, mobile, email and your answers) so our sales team can contact you about Empire Gold. We do not sell or share them with anyone else.</p>
          <p>If you came from a Facebook or Instagram ad, we tell Meta that an enquiry was made, using a scrambled (hashed) form of your mobile and email, so that our ads reach people with similar interests. You can opt out of ad personalisation in your Meta account settings.</p>
          <p>We count page visits without cookies of our own. If our ads are running, Meta&apos;s Pixel may set its own cookie.</p>
          <p>To see, correct or delete your details, write to us or call {P.phones[0]}. Data controller: {P.developer}, {P.address}.</p>
        </div>
      </div></main>
      <Footer />
    </>
  );
}
