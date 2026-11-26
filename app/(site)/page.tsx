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

// Room sizes are read off the architect's typical-floor drawing, in metres.
type Home = { name: string; size: string; plan: string; alt: string; line: string; rooms: [string, string][]; where: string; dock?: boolean };
const HOMES: Home[] = [
  { name: '1 BHK', size: '442 sq.ft carpet', plan: '/img/flat-04.jpg', alt: 'Plan of flat 04, a 1 BHK',
    line: 'A living room long enough for a sofa and a dining table, a bedroom of its own, and the bath and WC kept separate.',
    rooms: [['Living', '5.40 × 3.05 m'], ['Bedroom', '2.75 × 2.90 m'], ['Kitchen', '2.10 × 3.05 m'], ['Bath', '1.50 × 1.50 m'], ['WC', '0.90 × 1.50 m']],
    where: 'Flat 04 on floors 9 to 14, on the Mazagon Dock side.', dock: true },
  { name: '1 BHK large', size: '488 sq.ft carpet', plan: '/img/flat-03.jpg', alt: 'Plan of flat 03, the larger 1 BHK',
    line: 'The roomiest layout on the typical floors: a deep living room, a bedroom over four metres long and two toilets.',
    rooms: [['Living', '2.74 × 5.70 m'], ['Bedroom', '2.75 × 4.33 m'], ['Kitchen', '2.52 × 1.93 m'], ['Toilet', '2.68 × 1.22 m'], ['Toilet', '2.53 × 1.20 m']],
    where: 'Flat 03 on floors 9 to 14.' },
  { name: '1 RK', size: '296 sq.ft carpet', plan: '/img/flat-05.jpg', alt: 'Plan of flat 05, a 1 RK',
    line: 'One good-sized room with a kitchen big enough to eat in, and the bath and WC kept separate.',
    rooms: [['Room', '2.90 × 4.07 m'], ['Kitchen', '2.75 × 2.90 m'], ['Bath', '1.20 × 1.50 m'], ['WC', '0.90 × 1.50 m']],
    where: 'Flat 05 on floors 9 to 14, on the Mazagon Dock side.', dock: true },
  { name: '1 RK', size: '298 sq.ft carpet', plan: '/img/flat-01.jpg', alt: 'Plan of flat 01, a 1 RK',
    line: 'A wide main room, a separate kitchen, and the bath and WC kept apart. A first home, or a rental close to the station.',
    rooms: [['Room', '4.40 × 3.05 m'], ['Kitchen', '2.10 × 2.90 m'], ['Bath', '1.50 × 1.20 m'], ['WC', '0.90 × 1.20 m']],
    where: 'Flats 01 and 02 on floors 9 to 14, and on the 15th floor.' },
];

export default async function Home() {
  const { flats, ups } = await load();
  const left = flats.filter((f) => !f.booked).length;
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="wrap">
            <div>
              <h1>A small home, done properly</h1>
              <p className="lead">Thirty-five compact homes, 252 to 621 sq.ft, on floors 8 to 15 of Empire Gold on Dockyard Road, Mazgaon. The seven floors below are already built and lived in.</p>
              <div className="acts">
                <a className="btn btn-gold" href="#visit">Book a site visit</a>
                <a className="btn btn-line" href="#homes">See the homes</a>
              </div>
              <div className="facts">
                <span><b>2 minutes</b> to Dockyard Road station</span>
                <span><b>{left === 35 ? '35 homes' : `${left} of 35`}</b> {left === 35 ? 'in Phase II' : 'still open'}</span>
                <span>MahaRERA <b>{P.rera}</b></span>
              </div>
            </div>
            <figure>
              <img src="/img/tower-1100.jpg" alt="Empire Gold, a fifteen-storey tower with slate, grey and ochre facade panels" fetchPriority="high" />
              <figcaption>Artistic impression of the completed tower.</figcaption>
            </figure>
          </div>
        </section>

        <section className="band stone" id="homes">
          <div className="wrap">
            <div className="homes-intro">
              <h2>Small homes, planned to the last foot</h2>
              <p className="lead" style={{ marginTop: 0 }}>Every home here is compact. What matters is how the space is used: rooms you can actually furnish, a kitchen of its own, and the bath and WC split so two people can get ready at once.</p>
            </div>
            {HOMES.map((h, i) => (
              <article className={`home${i % 2 ? ' flip' : ''}`} key={h.plan}>
                <div className="plan"><img src={h.plan} alt={h.alt} loading="lazy" /></div>
                <div>
                  <h3>{h.name}</h3>
                  <span className="sz">{h.size}</span>
                  <p className="d">{h.line}</p>
                  <ul className="rooms">{h.rooms.map(([a, b], k) => <li key={k}><span>{a}</span>{b}</li>)}</ul>
                  <p className="where">{h.dock && <i aria-hidden="true" />}{h.where}</p>
                </div>
              </article>
            ))}
            <article className="home">
              <div className="plan"><img src="/img/plan8.jpg" alt="Plan of the 8th floor, with the 1.5 BHK" loading="lazy" /></div>
              <div>
                <h3>1.5 BHK</h3>
                <span className="sz">621 sq.ft carpet</span>
                <p className="d">The largest home in Phase II, and the only one of its kind: a bedroom, a living room and an extra half room for a study or a child.</p>
                <p className="where">The 8th floor. Neighbouring homes on some floors can also be combined into a 2 or 3 BHK; ask at the site office.</p>
              </div>
            </article>
            <p className="note">Room sizes are taken from the architect&apos;s drawings. Sizes in sq.ft are MahaRERA carpet area; the C.A. figures printed on the drawings are BMC carpet area, which is smaller.</p>
          </div>
        </section>

        <section className="band" id="dock">
          <div className="wrap dock">
            <figure style={{ margin: 0 }}>
              <img src="/img/living-a.jpg" alt="A furnished 1 BHK living room with a wide window toward the Mazagon Dock crane and the harbour" loading="lazy" />
              <figcaption className="cap">Artistic impression of a furnished dock-side 1 BHK. Furniture and décor are not part of the sale, and the view differs by floor.</figcaption>
            </figure>
            <div>
              <h2>Flats 04 and 05 face the dock</h2>
              <p className="lead">On floors 9 to 14, the 04 and 05 homes sit on the Mazagon Dock side of the building, looking toward the dock and the harbour beyond it.</p>
            </div>
          </div>
        </section>

        <section className="band stone">
          <div className="wrap lived">
            <div>
              <h2>The building is already lived in</h2>
              <p className="lead">Phase I, the first seven floors, is built, sold and occupied. Walk into the lobby, take the lift and see how the building is kept before you pay anything.</p>
            </div>
            <dl>
              <div><dt>Built by</dt><dd>The family that owns the land, with the site office in the building.</dd></div>
              <div><dt>MahaRERA</dt><dd>Registered as {P.rera}.</dd></div>
              <div><dt>Getting around</dt><dd>Dockyard Road station is two minutes on foot; the Eastern Freeway is seven minutes away.</dd></div>
              <div><dt>Next door</dt><dd>Joseph Baptista Garden on Mazgaon hill.</dd></div>
            </dl>
          </div>
        </section>

        <section className="band" id="floors">
          <div className="wrap">
            <h2>Choose a floor</h2>
            <p className="lead">Open a floor to see its homes and the plan. A small square marks the dock-side flats.</p>
            <Floors flats={flats} />
          </div>
        </section>

        <section className="band stone" id="built">
          <div className="wrap">
            <h2>What it is built with</h2>
            <div className="specs">{SPECS.map(([a, b]) => <div key={a}><h3>{a}</h3><p>{b}</p></div>)}</div>
            <p className="amen"><b>In the building:</b> {AMENITIES.join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}.</p>
            <p className="note">The fitness centre and 15th-floor terraces are shared by all residents. Car parking is allotted separately. Material samples and a model flat are at the site office.</p>
          </div>
        </section>

        <section className="band" id="location">
          <div className="wrap loc">
            <div>
              <h2>Dockyard Road, Mazgaon</h2>
              <p className="lead">On the Harbour line, with schools, the garden and the station all within a few minutes.</p>
              <ul className="dist">{DISTANCES.map(([a, b]) => <li key={a}><span>{a}</span><b>{b}</b></li>)}</ul>
              <a className="btn btn-line" href={P.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a>
            </div>
            <img src="/img/map.jpg" alt="Map showing Empire Gold near Dockyard Road station and Joseph Baptista Garden" loading="lazy" />
          </div>
        </section>

        {ups.length > 0 && (
          <section className="band stone">
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
