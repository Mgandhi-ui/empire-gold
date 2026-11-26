import type { Metadata } from 'next';
import { Header, Footer } from '../_c/Chrome';
import PartnerForm from '../_c/PartnerForm';

export const metadata: Metadata = { title: 'Channel partners', description: 'Brokers: register your clients for Empire Gold, Mazgaon, and track them in your own partner login.' };

const WHY: [string, string][] = [
  ['Your clients stay yours', 'Register a client in your partner login before the first visit. From that moment the client is recorded against your name.'],
  ['Everything in one login', 'See each client you registered, their visits, the flat they booked and the status of every sale, without calling the office.'],
  ['A building you can show', 'Phase I is built and occupied. Bring clients to see the lobby, the model flat and the floors going up above.'],
  ['A site office that answers', 'Floor plans, cost sheets and visit slots from one team, on one number, the same day.'],
];
const STEPS = ['Apply below with your MahaRERA agent number.', 'We check it and send your partner login to your email.', 'Register each client in the login before you bring them.', 'Accompany the visit. We handle the paperwork and keep you updated in the login.'];

export default function Partners() {
  return (
    <>
      <Header />
      <main>
        <section className="band dark">
          <div className="wrap">
            <p className="eyebrow">Channel partners</p>
            <h2>Sell Empire Gold with us</h2>
            <p className="lead">We work with MahaRERA-registered brokers across Mazgaon, Byculla, Dongri, Agripada and the rest of South and Central Mumbai.</p>
          </div>
        </section>
        <section className="band">
          <div className="wrap">
            <div className="proof" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
              {WHY.map(([a, b]) => <div key={a}><h3>{a}</h3><p>{b}</p></div>)}
            </div>
          </div>
        </section>
        <section className="band dark" id="apply">
          <div className="wrap formgrid">
            <div className="contactlist">
              <p className="eyebrow">How it works</p>
              <h2>Four steps</h2>
              <ol style={{ paddingLeft: 20, marginTop: 18, color: '#C9D3DC', display: 'grid', gap: 10 }}>{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
              <p style={{ marginTop: 18 }}>Already a partner? <a href="https://back.empiregoldmazgaon.com/login" style={{ color: '#fff' }}>Log in</a></p>
            </div>
            <PartnerForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
