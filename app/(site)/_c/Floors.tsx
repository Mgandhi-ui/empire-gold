// The floor directory: Phase II floors 15 down to 8, each opening to its homes and plan. Floors 1–7 sit below as one row.
import { planFor } from '@/lib/project';

type Flat = { no: string; floor: number; type: string; sqft: number; booked: boolean };
const dock = (h: Flat) => h.floor >= 9 && h.floor <= 14 && /0[45]$/.test(h.no);
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const NOTE: Record<number, string> = { 8: 'Includes the 1.5 BHK, the largest home in Phase II.', 15: 'Top floor, beside the fitness centre and the open-to-sky terraces.' };

export default function Floors({ flats }: { flats: Flat[] }) {
  const floors = [15, 14, 13, 12, 11, 10, 9, 8];
  return (
    <div className="dir">
      {floors.map((n) => {
        const homes = flats.filter((f) => f.floor === n);
        const open = homes.filter((h) => !h.booked).length;
        const mix = Array.from(new Set(homes.map((h) => h.type.replace(' (Large)', '').replace(' (Compact)', '')))).join(', ');
        return (
          <details className="fl" key={n} open={n === 12}>
            <summary>
              <span className="bar" aria-hidden="true" />
              <span className="n">{n}</span>
              <span className="mix">{homes.length} homes: {mix}</span>
              <span className="open">{open === 0 ? 'All booked' : `${open} open`}</span>
              <span className="chev" aria-hidden="true" />
            </summary>
            <div className="body">
              <div>
                <ul className="homes">
                  {homes.map((h) => (
                    <li key={h.no} className={h.booked ? 'sold' : ''}><b>Flat {h.no}{dock(h) && <i className="dk" title="Mazagon Dock side" />}</b><span>{h.type}, {h.sqft} sq.ft</span></li>
                  ))}
                </ul>
                {NOTE[n] && <p className="cap" style={{ marginTop: 14 }}>{NOTE[n]}</p>}
              </div>
              <div>
                <img src={planFor(n)} alt={`Floor plan of the ${ord(n)} floor`} loading="lazy" />
                <p className="cap">Sizes are MahaRERA carpet area. The C.A. figures on the architect&apos;s drawing are BMC carpet area, which is smaller.</p>
              </div>
            </div>
          </details>
        );
      })}
      <div className="fl p1"><div className="row"><span className="bar" aria-hidden="true" /><span className="n">1–7</span><span>Phase I. Built, sold and lived in.</span></div></div>
    </div>
  );
}
