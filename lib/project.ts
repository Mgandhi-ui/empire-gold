// Fixed facts about Empire Gold, used by the website. Prices and brokerage never live here.
export const P = {
  name: 'Empire Gold',
  address: '51C, Dockyard Road, Mazgaon, Mumbai 400 010',
  rera: 'P51900008690',
  reraSite: 'maharera.maharashtra.gov.in',
  phones: ['+91 99301 12352', '+91 98604 07886'],
  whatsapp: '919930112352',
  developer: 'Jakubbhai Lalji Dal Mills Pvt. Ltd.',
  mapsUrl: 'https://maps.google.com/?q=51C+Dockyard+Road+Mazgaon+Mumbai+400010',
};

export const DISTANCES: [string, string][] = [
  ['Dockyard Road station', '2 min walk'],
  ['Bus depot', '5 min walk'],
  ['Maharana Pratap Chowk', '5 min'],
  ['Eastern Freeway', '7 min'],
  ['Joseph Baptista Garden', 'Next door'],
  ["St Mary's, St Peter's, Fazlani schools", 'Nearby'],
];

export const SPECS: [string, string][] = [
  ['Kitchen', 'Modular kitchen with granite top, stainless-steel sink and tiled dado.'],
  ['Floors and walls', 'Vitrified tiles in every room; POP-finished internal walls.'],
  ['Bathrooms', 'Branded sanitaryware, door-height tiles, separate dry and wet areas.'],
  ['Doors and windows', 'Teak-framed doors; anodised aluminium sliding windows.'],
  ['Electrical and plumbing', 'Concealed ISI wiring with circuit protection; concealed plumbing.'],
  ['Security', 'Manned security round the clock, with CCTV.'],
];

export const AMENITIES = ['Grand lobby with designer entrance gate', 'Automated puzzle car parking', 'Visitor parking', 'Landscaped garden on natural ground',
  'Fitness centre on the 15th floor', 'Open-to-sky terraces on the 15th floor'];

export const HOMES = [
  { type: '1 RK', sizes: '252–298', img: '/img/rk.jpg', line: 'A first home or a rental investment in South Mumbai.', rooms: 'One room, kitchen, toilet with shower' },
  { type: '1 BHK', sizes: '419–442', img: '/img/bhk.jpg', line: 'For couples and small families.', rooms: 'Living and dining, bedroom with attached toilet, common toilet, kitchen' },
  { type: '1 BHK (Large)', sizes: '488', img: '/img/bhkl.jpg', line: 'The roomiest layout on the typical floors, 9th to 14th.', rooms: 'Larger living and bedroom, attached and common toilets, kitchen' },
  { type: '1.5 BHK', sizes: '621', img: '/img/plan8.jpg', line: 'The single largest home in Phase II, on the 8th floor. Adjacent homes can also combine into a 2 or 3 BHK.', rooms: 'Living, bedroom and an extra half room; see the 8th-floor plan' },
];

/** Static copy of the 35 flats, used if the database cannot be reached. */
export const FLATS: { no: string; floor: number; type: string; sqft: number }[] = [
  ['803', 8, '1.5 BHK', 621], ['804', 8, '1 BHK', 419], ['805', 8, '1 RK', 296],
  ...[9, 10, 11, 12, 13, 14].flatMap((f) => [[`${f}01`, f, '1 RK', 298], [`${f}02`, f, '1 RK', 298], [`${f}03`, f, '1 BHK (Large)', 488], [`${f}04`, f, '1 BHK', 442], [`${f}05`, f, '1 RK', 296]]),
  ['1501', 15, '1 RK', 298], ['1502', 15, '1 RK (Compact)', 252],
].map(([no, floor, type, sqft]) => ({ no: String(no), floor: Number(floor), type: String(type), sqft: Number(sqft) }));

export const planFor = (floor: number) => (floor === 8 ? '/img/plan8.jpg' : floor === 15 ? '/img/plan15.jpg' : '/img/plan.jpg');
