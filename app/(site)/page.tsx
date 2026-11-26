import Link from 'next/link';
import { q } from '@/lib/db';
import { fmtDate } from '@/lib/core';
import { P, DISTANCES, SPECS, AMENITIES, HOMES, FLATS } from '@/lib/project';
import { Header, Footer } from './_c/Chrome';
import Tower from './_c/Tower';
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

export default async function Home() {
  const { flats, ups } = await load();
  const left = flats.filter((f) => !f.booked).length;
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="wrap">
            <div className="hero-txt">
              <p className="eyebrow">Phase II now booking · Floors 8–15 · Mazgaon</p>
              <h1>35 homes above a building that <em>already stands.</em></h1>
              <p>Empire Gold, 51C Dockyard Road. The first seven floors are built and lived in. Phase II rises on the same tower.</p>
              <div className="acts">
                <a className="btn btn-gold" href="#enquire">Book a site visit</a>
                <a className="btn btn-line" href="#building">See the floors</a>
              </div>
              <div className="facts">
                <div><b>252–621</b><span>sq.ft MahaRERA carpet</span></div>
                <div><b>2 min</b><span>walk to Dockyard Road station</span></div>
                <div><b>{left === 35 ? '35' : left}</b><span>{left === 35 ? 'homes, no more' : 'homes still open'}</span></div>
              </div>
            </div>
            <div className="hero-pic">
              <img src="/img/tower-hero-v2.jpg" alt="Architectural render of the Empire Gold tower on Dockyard Road, Mazgaon" fetchPriority="high" />
              <span className="tag t2">Floors 8–15 · Phase II</span>
              <span className="tag t1">Floors 1–7 · Delivered</span>
              <span className="ai-note">Artistic impression</span>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="wrap proof">
            <div><h3>Already standing</h3><p>Phase I, seven storeys, is built, sold and occupied. You are buying into a building you can walk into today, not a hoarding.</p></div>
            <div><h3>A South Mumbai address</h3><p>Mazgaon 400 010, two minutes from Dockyard Road station and seven from the Eastern Freeway, with Joseph Baptista Garden next door.</p></div>
            <div><h3>Small by design</h3><p>Only 35 homes across eight floors, built and sold by the family that owns the land, with a site office you can walk into.</p></div>
          </div>
        </section>

        <section className="band dark" id="building">
          <div className="wrap">
            <p className="eyebrow">The building</p>
            <h2>Two phases, one tower</h2>
            <p className="lead">Pick a floor to see its homes and its plan. Phase II adds eight storeys on top of the delivered Phase I, taking Empire Gold to fifteen.</p>
            <Tower flats={flats} />
          </div>
        </section>

        <section className="band" id="homes">
          <div className="wrap">
            <p className="eyebrow">Homes</p>
            <h2>Choose your home</h2>
            <p className="lead">Four layouts from 252 to 621 sq.ft of MahaRERA carpet. Neighbouring homes on select floors can be combined into a 2 or 3 BHK.</p>
            <div className="homes">
              {HOMES.map((h) => (
                <article className="home" key={h.type}>
                  <img className={h.img.includes('plan') ? 'contain' : ''} src={h.img} alt={`${h.type} layout`} loading="lazy" />
                  <div>
                    <h3>{h.type}</h3>
                    <span className="sz">{h.sizes} sq.ft</span>
                    <p>{h.line}</p>
                    <p className="rooms">{h.rooms}</p>
                    <a href="#enquire">Ask about {h.type} →</a>
                  </div>
                </article>
              ))}
            </div>
            <p className="note">Layouts are 3D illustrations. Furniture, appliances and décor are not part of the sale.</p>
          </div>
        </section>

        <section className="band" id="location" style={{ background: 'var(--paper)' }}>
          <div className="wrap loc">
            <div>
              <p className="eyebrow">Location</p>
              <h2>Everything close, nothing loud</h2>
              <p className="lead">On Dockyard Road, on the Harbour line, with the Eastern Freeway seven minutes away.</p>
              <ul className="dist">{DISTANCES.map(([a, b]) => <li key={a}><span>{a}</span><b>{b}</b></li>)}</ul>
              <p style={{ marginTop: 18 }}><a className="btn btn-line" href={P.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a></p>
            </div>
            <img src="/img/map.jpg" alt="Map showing Empire Gold near Dockyard Road station and Joseph Baptista Garden" loading="lazy" />
          </div>
        </section>

        <section className="band" id="specs">
          <div className="wrap">
            <p className="eyebrow">Specifications</p>
            <h2>Built properly, inside and out</h2>
            <div className="specs">{SPECS.map(([a, b]) => <div key={a}><h3>{a}</h3><p>{b}</p></div>)}</div>
            <div className="amen" aria-label="Common amenities">{AMENITIES.map((a) => <span key={a}>{a}</span>)}</div>
            <p className="note">Fitness centre and 15th-floor terraces are common amenities for all residents, not part of any flat. Car parking is allotted separately. Material samples and a model flat are at the site office.</p>
          </div>
        </section>

        {ups.length > 0 && (
          <section className="band" style={{ background: 'var(--paper)' }}>
            <div className="wrap">
              <p className="eyebrow">Construction updates</p>
              <h2>What happened on site</h2>
              <div className="ups">
                {ups.map((u) => (
                  <article className="up" key={u.id}>
                    {u.has_photo && <img src={`/api/update-photo/${u.id}`} alt={u.title} loading="lazy" />}
                    <div><time>{fmtDate(u.date)}</time><h3>{u.title}</h3><p>{u.body}</p></div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="band dark" id="enquire">
          <div className="wrap formgrid">
            <div className="contactlist">
              <p className="eyebrow">Visit</p>
              <h2>See Phase I, the model flat and the floors going up</h2>
              <p className="lead">Leave your number and we will call you to fix a time. A visit takes about thirty minutes.</p>
              <p>Site office: {P.address}</p>
              <p>Call: <b>{P.phones[0]}</b> · <b>{P.phones[1]}</b></p>
            </div>
            <EnquiryForm />
          </div>
        </section>

        <section className="band" style={{ paddingBlock: 56 }}>
          <div className="wrap pband">
            <div><p className="eyebrow">For brokers</p><h2>Bring your clients to Empire Gold</h2></div>
            <Link className="btn btn-gold" href="/partners">Become a channel partner</Link>
          </div>
        </section>
      </main>
      <Footer />
      <a className="btn btn-gold float" href="#enquire">Book a visit</a>
    </>
  );
}
