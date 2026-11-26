'use client';
// The tower, floor by floor: 1–7 delivered, 8–15 selectable, with that floor's homes and plan.
import { useState } from 'react';

type Flat = { no: string; floor: number; type: string; sqft: number; booked: boolean };
const plan = (f: number) => (f === 8 ? '/img/plan8.jpg' : f === 15 ? '/img/plan15.jpg' : '/img/plan.jpg');
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export default function Tower({ flats }: { flats: Flat[] }) {
  const [floor, setFloor] = useState(10);
  const on = flats.filter((f) => f.floor === floor);
  const floors = Array.from({ length: 15 }, (_, i) => 15 - i);
  return (
    <div className="tw">
      <div>
        <div className="stack" role="group" aria-label="Choose a floor">
          {floors.map((n) => {
            const homes = flats.filter((f) => f.floor === n);
            if (n <= 7) return <div key={n} className="fl p1"><b>{n}</b><span>Phase I · lived in</span></div>;
            return (
              <button key={n} type="button" className={`fl p2${n === floor ? ' on' : ''}`} aria-pressed={n === floor} onClick={() => setFloor(n)}>
                <b>{n}</b>
                <span className="dots" aria-label={`${homes.length} homes`}>{homes.map((h) => <i key={h.no} className={h.booked ? 'x' : ''} />)}</span>
              </button>
            );
          })}
        </div>
        <div className="ground" />
        <div className="legend"><span><i style={{ background: '#2A3B63' }} />Phase I, floors 1–7: built and occupied</span><span><i style={{ background: '#C9A24A' }} />Phase II, floors 8–15: 35 homes</span></div>
      </div>
      <div className="floorcard" aria-live="polite">
        <h3>{ord(floor)} floor</h3>
        <p className="sub">{on.length} {on.length === 1 ? 'home' : 'homes'} · {floor === 8 ? 'includes the refuge floor area' : floor === 15 ? 'top floor, beside the fitness centre and open-to-sky terraces' : 'the typical floor plate, repeated 9th to 14th'}</p>
        <div className="units">
          {on.map((f) => (
            <div key={f.no} className={`unit${f.booked ? ' sold' : ''}`}>
              <b>Flat {f.no}</b><span>{f.type} · {f.sqft} sq.ft</span>{f.booked && <><br /><em>Booked</em></>}
            </div>
          ))}
        </div>
        <img className="planimg" src={plan(floor)} alt={`Floor plan, ${ord(floor)} floor`} loading="lazy" />
        <p className="note">Sizes are MahaRERA carpet area. Figures marked C.A. on the architect&apos;s drawing are BMC carpet area, which is smaller.</p>
      </div>
    </div>
  );
}
