import Link from 'next/link';
import { q } from '@/lib/db';
import { fmtDate } from '@/lib/core';
import { P, DISTANCES, SPECS, AMENITIES, FLATS } from '@/lib/project';
import { Header, Footer } from './_c/Chrome';
import Floors from './_c/Floors';
import EnquiryForm from './_c/EnquiryForm';

export const revalidate = 300; // refresh booked flats and updates every 5 minutes

async function load() {
  try {
    const flats = await q<{ no: string; floor: number; type: string; carpet_sqft: number; status: string }>('select no, floor, type, carpet_sqft, status from flats order by floor, no');
    const ups = await q<{ id: number; date: string; title: string; body: string; has_photo: boolean }>(
      'select id, date, title, body, photo is not null as has_photo from updates where public order by date desc, id desc limit 3');
    return { flats: flats.map((f) => ({ no: f.no, floor: f.floor, type: f.type, sqft: f.carpet_sqft, booked: f.status === 'booked' })), ups };
  } catch {
    return { flats: FLATS.map((f) => ({ ...f, booked: false })), ups: [] };
  }
}

const TYPES: [string, string, string][] = [
  ['1 RK', '252–298 sq.ft', 'One room, kitchen and a toilet with shower. A first home, or a rental in South Mumbai.'],
  ['1 BHK', '419–442 sq.ft', 'Living and dining, bedroom with attached toilet, common toilet, kitchen.'],
  ['1 BHK large', '488 sq.ft', 'The roomiest layout on floors 9 to 14, with a larger living room and bedroom.'],
  ['1.5 BHK', '621 sq.ft', 'One home only, on the 8th floor. Neighbouring homes can also be combined into a 2 or 3 BHK.'],
];

export default async function Home() {
  const { flats, ups } = await load();
  const left = flats.filter((f) => !f.booked).length;
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <picture>
            <source media="(max-width: 820px)" srcSet="/img/tower-1100.jpg" />
            <img src="/img/tower-2000.jpg" alt="Empire Gold tower on Dockyard Road, Mazgaon, fifteen storeys with slate, grey and ochre facade panels" fetchPriority="high" />
          </picture>
          <span className="note">Artistic impression</span>
          <div className="wrap herowrap"><div className="copy">
            <h1>Thirty-five homes above Dockyard Road</h1>
            <p>Empire Gold Phase II, floors 8 to 15. The seven floors below are already built and lived in.</p>
            <div className="acts">
              <a className="btn btn-gold" href="#visit">Book a site visit</a>
              <a className="btn btn-line" href="#floors">See the floors</a>
            </div>
          </div></div>
        </section>

        <section className="band stands">
          <div className="wrap">
            <div>
              <h2>The building is already here</h2>
              <p className="lead">Seven floors are built, sold and lived in. Walk into the lobby, take the lift and see the building before you pay anything.</p>
            </div>
            <dl>
              <div><dt>MahaRERA</dt><dd>Registered as {P.rera}.</dd></div>
              <div><dt>Who builds it</dt><dd>The family that owns the land. The site office is in the building.</dd></div>
              <div><dt>How many homes</dt><dd>{left === 35 ? 'Thirty-five, across eight floors.' : `${left} of 35 still open.`}</dd></div>
              <div><dt>Station</dt><dd>Dockyard Road, two minutes on foot.</dd></div>
            </dl>
          </div>
        </section>

        <section className="band" id="floors">
          <div className="wrap">
            <h2>Choose a floor</h2>
            <p className="lead">Open a floor to see its homes, their sizes and the plan.</p>
            <Floors flats={flats} />
          </div>
        </section>

        <section className="band inside" id="homes" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <h2>Inside</h2>
            <table className="types">
              <thead><tr><th scope="col">Home</th><th scope="col">Carpet area</th><th scope="col">Rooms</th></tr></thead>
              <tbody>{TYPES.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
            </table>
            <div className="specs" id="specs">{SPECS.map(([a, b]) => <div key={a}><h3>{a}</h3><p>{b}</p></div>)}</div>
            <p className="amen"><b>In the building:</b> {AMENITIES.join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}.</p>
            <p className="note">The fitness centre and 15th-floor terraces are shared by all residents. Car parking is allotted separately. Material samples and a model flat are at the site office.</p>
          </div>
        </section>

        <section className="band" id="location" style={{ background: 'var(--haze)' }}>
          <div className="wrap loc">
            <div>
              <h2>Dockyard Road, Mazgaon 400 010</h2>
              <p className="lead">On the Harbour line, seven minutes from the Eastern Freeway.</p>
              <ul className="dist">{DISTANCES.map(([a, b]) => <li key={a}><span>{a}</span><b>{b}</b></li>)}</ul>
              <a className="btn btn-line" href={P.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a>
            </div>
            <img src="/img/map.jpg" alt="Map showing Empire Gold near Dockyard Road station and Joseph Baptista Garden" loading="lazy" />
          </div>
        </section>

        {ups.length > 0 && (
          <section className="band">
            <div className="wrap">
              <h2>On site lately</h2>
              <div className="ups">
                {ups.map((u) => (
                  <article className="up" key={u.id}>
                    {u.has_photo && <img src={`/api/update-photo/${u.id}`} alt={u.title} loading="lazy" />}
                    <time>{fmtDate(u.date)}</time><h3>{u.title}</h3><p>{u.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="band visit" id="visit">
          <span id="enquire" />
          <div className="wrap formgrid">
            <div className="contactlist">
              <h2>Come and see it</h2>
              <p className="lead">Leave your number and the site office will call to fix a time. A visit takes about thirty minutes: Phase I, the model flat and the floors going up.</p>
              <p style={{ marginTop: 28 }}>{P.address}</p>
              <p>Call <b>{P.phones[0]}</b> or <b>{P.phones[1]}</b></p>
            </div>
            <EnquiryForm />
          </div>
        </section>

        <section className="band" style={{ paddingBlock: 64 }}>
          <div className="wrap pband">
            <h2>Brokers: register your clients with us</h2>
            <Link className="btn btn-line" href="/partners">Become a channel partner</Link>
          </div>
        </section>
      </main>
      <Footer />
      <a className="btn btn-gold float" href="#visit">Book a visit</a>
    </>
  );
}
