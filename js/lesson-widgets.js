/* FULL NPPL INSIDER — interactive lesson widgets.
   Currently: an ORIGINAL, fictional sample 1:500,000-style VFR chart (vector SVG) drawn in the style of the
   UK CAA ICAO 1:500,000 chart legend (Edition 2025 legend sheet). It is NOT a copy of any CAA/NATS chart,
   it shows an invented area, and it must never be used for navigation.
   Widgets are created automatically when a lesson containing <div data-widget="vfrchart"> is rendered. */
(function () {
  'use strict';
  const W = 640, H = 480;                 // world units; 10 units = 1 NM
  const C = {
    blue: '#3a3fa6', blueT: '#8f93dc', mag: '#a8227f', magT: '#e3a1cf', pink: '#f7d6ec',
    red: '#c2185b', land: '#eef2dc', t1: '#e4dfbd', t2: '#d8c99c', t3: '#c9b07f', cont: '#9a7d55',
    water: '#bfe0f2', river: '#3f86c4', town: '#f4d65a', townE: '#a88400', road: '#c0392b', ink: '#1d1d2b'
  };
  const FONT = 'font-family="Arial,Helvetica,sans-serif"';
  let uid = 0;

  /* ---------- geometry helpers ---------- */
  const pts = a => a.map(p => p.join(',')).join(' ');
  function circlePts(cx, cy, r, n) { const o = []; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; o.push([+(cx + r * Math.cos(t)).toFixed(1), +(cy + r * Math.sin(t)).toFixed(1)]); } return o; }
  // filled half-discs along a closed polygon, bulging inward (RMZ/TMZ style)
  function scallops(poly, size, colorA, colorB) {
    let out = '', k = 0;
    // signed area to know orientation
    let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
    const sweep = a > 0 ? 1 : 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]); const n = Math.max(1, Math.round(len / size));
      for (let j = 0; j < n; j++) {
        const x0 = p[0] + (q[0] - p[0]) * j / n, y0 = p[1] + (q[1] - p[1]) * j / n;
        const x1 = p[0] + (q[0] - p[0]) * (j + 1) / n, y1 = p[1] + (q[1] - p[1]) * (j + 1) / n;
        const r = len / n / 2;
        const col = colorB && (k++ % 2) ? colorB : colorA;
        out += `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 0 ${sweep} ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${col}"/>`;
      }
    }
    return out;
  }
  function label(x, y, s, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" ${FONT} font-size="${o.size || 7}" fill="${o.fill || C.ink}" text-anchor="${o.anchor || 'middle'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.italic ? ' font-style="italic"' : ''}${o.rotate ? ` transform="rotate(${o.rotate} ${x} ${y})"` : ''}${o.halo === false ? '' : ' paint-order="stroke" stroke="#fff" stroke-width="1.6" stroke-opacity=".85"'}>${s}</text>`;
  }

  /* ---------- symbol drawers (shared by map and legend) ---------- */
  const S = {
    civil(x, y, col) { col = col || C.blue; let t = ''; [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(d => { t += `<line x1="${x + d[0] * 5}" y1="${y + d[1] * 5}" x2="${x + d[0] * 7.5}" y2="${y + d[1] * 7.5}" stroke="${col}" stroke-width="1.8"/>`; }); return `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${col}" stroke-width="1.8"/>${t}`; },
    civilLtd(x, y) { return `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${C.blue}" stroke-width="1.8"/>`; },
    training(x, y) { return S.civilLtd(x, y) + `<text x="${x + 7}" y="${y + 9}" ${FONT} font-size="6" font-weight="bold" fill="${C.blue}">T</text>`; },
    military(x, y) { return `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${C.mag}" stroke-width="1.8"/><circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${C.mag}" stroke-width="1.6"/>`; },
    heli(x, y) { return `<circle cx="${x}" cy="${y}" r="5.5" fill="#fff" stroke="${C.blue}" stroke-width="1.6"/><text x="${x}" y="${y + 2.6}" ${FONT} font-size="7" font-weight="bold" text-anchor="middle" fill="${C.blue}">H</text>`; },
    micro(x, y) { return `<circle cx="${x}" cy="${y}" r="5.5" fill="#fff" stroke="${C.blue}" stroke-width="1.6"/><text x="${x}" y="${y + 2.6}" ${FONT} font-size="7" font-weight="bold" text-anchor="middle" fill="${C.blue}">M</text>`; },
    disused(x, y) { return `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${C.blue}" stroke-width="1.5"/><path d="M${x - 3.3},${y - 3.3}L${x + 3.3},${y + 3.3}M${x + 3.3},${y - 3.3}L${x - 3.3},${y + 3.3}" stroke="${C.blue}" stroke-width="1.4"/>`; },
    glider(x, y) { return `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${C.blue}" stroke-width="1.5"/><text x="${x}" y="${y + 3.4}" ${FONT} font-size="9" font-weight="bold" text-anchor="middle" fill="${C.blue}">G</text><text x="${x + 7}" y="${y + 11}" ${FONT} font-size="5.5" font-weight="bold" fill="${C.blue}">/2.5</text>`; },
    para(x, y) { return `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${C.blue}" stroke-width="1.5"/><path d="M${x - 4.5},${y - 0.5} A4.5,4.5 0 0 1 ${x + 4.5},${y - 0.5} Z" fill="${C.blue}"/><path d="M${x - 4.5},${y - 0.5}L${x},${y + 4.5}L${x + 4.5},${y - 0.5}M${x},${y - 0.5}L${x},${y + 4.5}" stroke="${C.blue}" stroke-width=".8" fill="none"/>`; },
    vrp(x, y) { return `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff" stroke="${C.blue}" stroke-width="1.2"/><path d="M${x - 3.2},${y}H${x + 3.2}M${x},${y - 3.2}V${y + 3.2}" stroke="${C.blue}" stroke-width="1"/>`; },
    obst(x, y) { return `<path d="M${x - 3},${y + 3} L${x},${y - 5} L${x + 3},${y + 3}" fill="none" stroke="${C.blue}" stroke-width="1.4"/><circle cx="${x}" cy="${y + 3}" r=".9" fill="${C.blue}"/>`; },
    obstLit(x, y) { let r = ''; [-50, -90, -130].forEach(a => { const t = a * Math.PI / 180; r += `<line x1="${(x + Math.cos(t) * 3).toFixed(1)}" y1="${(y - 6 + Math.sin(t) * 3).toFixed(1)}" x2="${(x + Math.cos(t) * 5.5).toFixed(1)}" y2="${(y - 6 + Math.sin(t) * 5.5).toFixed(1)}" stroke="${C.blue}" stroke-width=".9"/>`; }); return S.obst(x, y) + r; },
    obstHigh(x, y) { return `<path d="M${x - 3.5},${y + 4} L${x},${y - 8} L${x + 3.5},${y + 4} Z" fill="${C.blue}"/>` + `<path d="M${x - 4},${y - 10}l-2,-2M${x + 4},${y - 10}l2,-2M${x},${y - 11}v-3" stroke="${C.blue}" stroke-width=".9"/>`; },
    turbine(x, y) { return `<line x1="${x}" y1="${y + 4}" x2="${x}" y2="${y - 2}" stroke="${C.blue}" stroke-width="1.2"/><path d="M${x},${y - 2}l0,-4.5M${x},${y - 2}l3.9,2.2M${x},${y - 2}l-3.9,2.2" stroke="${C.blue}" stroke-width="1"/>`; },
    vor(x, y) { const p = circlePts(x, y, 4.5, 6); return `<polygon points="${pts(p)}" fill="#fff" stroke="${C.blue}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="1" fill="${C.blue}"/>`; },
    ndb(x, y) { let d = ''; for (let r = 3; r <= 7; r += 2) circlePts(x, y, r, Math.round(r * 3)).forEach(p => { d += `<circle cx="${p[0]}" cy="${p[1]}" r=".45" fill="${C.blue}"/>`; }); return d + `<circle cx="${x}" cy="${y}" r="1.4" fill="${C.blue}"/>`; },
    bird(x, y) { return `<circle cx="${x}" cy="${y}" r="6.5" fill="#fff" stroke="${C.blue}" stroke-width="1.3"/><path d="M${x - 4},${y + 1} q2,-4 5,-1 q2,-2 3,0 q-1,3 -5,3 q-2,0 -3,-2z" fill="${C.blue}"/>`; },
    hirta(x, y) { let g = ''; for (let i = -4; i <= 4; i += 2) g += `<path d="M${x + i},${y - 6}V${y + 6}M${x - 6},${y + i}H${x + 6}" stroke="${C.blue}" stroke-width=".5"/>`; return `<clipPath id="hc${x}_${y}"><circle cx="${x}" cy="${y}" r="6.5"/></clipPath><g clip-path="url(#hc${x}_${y})">${g}</g><circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="${C.blue}" stroke-width="1.3"/>`; },
    spot(x, y) { return `<circle cx="${x}" cy="${y}" r="1.1" fill="${C.ink}"/>`; }
  };

  /* ---------- legend / explanations (plain English, what to do) ---------- */
  const L = [
    { id: 'edition', grp: 'Chart basics', name: 'Title panel, edition & validity date', mini: m => `<rect x="2" y="4" width="36" height="16" fill="#fff" stroke="${C.blue}"/><text x="20" y="15" ${FONT} font-size="6" text-anchor="middle" fill="${C.blue}">Ed. 52</text>`, what: 'Every real CAA chart prints its edition number and the date its aeronautical information is valid from. Airspace changes every year, so an old chart can put you inside controlled airspace without knowing.', todo: 'Fly only with the current edition. Before using it, check the NATS AIS VFR chart amendment list for changes since the validity date, then check NOTAMs and the UK AIP for the day.' },
    { id: 'scale', grp: 'Chart basics', name: 'Scale bar (NM / km)', mini: m => `<path d="M3,14H37M3,10V18M20,12V16M37,10V18" stroke="${C.ink}" stroke-width="1.4"/>`, what: '1:500,000 means 1 cm on the chart is 5 km (about 2.7 NM) on the ground. 1 NM is about 3.7 mm. On a 1:250,000 chart everything is twice as big.', todo: 'Measure distances with the scale bar or a plotter set to the right scale (NM, not km or statute miles).' },
    { id: 'graticule', grp: 'Chart basics', name: 'Latitude & longitude lines', mini: m => `<path d="M2,8H38M2,18H38M12,2V22M28,2V22" stroke="#6a6a8a" stroke-width=".8"/>`, what: 'Graticule lines every 30 minutes of latitude and longitude, with minute ticks on the edges. 1 minute of latitude = 1 NM. The 1:500,000 chart is a Lambert conformal projection, so meridians converge slightly.', todo: 'Measure track angles against a meridian near the middle of the leg. Read positions as degrees and minutes N and W.' },
    { id: 'mef', grp: 'Chart basics', name: 'Maximum Elevation Figure (MEF)', mini: m => `<text x="14" y="20" ${FONT} font-size="18" font-weight="bold" fill="${C.blue}">2</text><text x="25" y="11" ${FONT} font-size="9" font-weight="bold" fill="${C.blue}">0</text>`, what: 'The big digit is thousands of feet and the small one hundreds, above mean sea level, for the highest known feature in that half-degree box, including terrain and obstacles, with an allowance for unknown ones. "2⁰" = 2,000 ft AMSL.', todo: 'Use it as a quick warning of high ground or masts. The legend says it is NOT a safety altitude: work out your own minimum safe altitude for each leg.' },
    { id: 'isogonal', grp: 'Chart basics', name: 'Isogonal (magnetic variation)', mini: m => `<path d="M3,20L37,4" stroke="${C.mag}" stroke-width="1.2" stroke-dasharray="4 2"/><text x="20" y="11" ${FONT} font-size="6" fill="${C.mag}">1°W</text>`, what: 'A dashed line joining places with the same magnetic variation. In the south of England it is now around 0–1° West (it changes slowly every year).', todo: 'Convert true track to magnetic: variation West, magnetic best (add); variation East, magnetic least (subtract). Use the variation printed near your route on the current chart.' },
    { id: 'terrain', grp: 'Topography', name: 'Contours & terrain colouring', mini: m => `<rect x="2" y="2" width="36" height="20" fill="${C.t1}"/><path d="M6,20 Q20,0 34,20" fill="${C.t2}" stroke="${C.cont}" stroke-width=".8"/><path d="M13,20 Q20,8 27,20" fill="${C.t3}" stroke="${C.cont}" stroke-width=".8"/>`, what: 'Thin brown contour lines join ground of equal height and the colour gets darker as the ground gets higher (layer tints). Close contours mean steep ground. Here: 500, 1,000 and 1,500 ft AMSL.', todo: 'Expect lower cloud bases, hill fog and turbulence over high ground. Plan to clear terrain and obstacles by a safe margin and never scud-run into rising ground.' },
    { id: 'spot', grp: 'Topography', name: 'Spot heights', mini: m => `<circle cx="12" cy="13" r="1.6" fill="${C.ink}"/><text x="16" y="15" ${FONT} font-size="8" fill="${C.ink}">1043</text>`, what: 'A dot with a number is the height of that point in feet above mean sea level. The highest spot heights are often hilltops.', todo: 'Use them with the MEF when you work out a minimum safe altitude, and as checkpoints when hills are visible.' },
    { id: 'water', grp: 'Topography', name: 'Water: coast, rivers & lakes', mini: m => `<rect x="2" y="2" width="36" height="20" fill="${C.water}"/><path d="M2,16 Q14,6 22,14 T38,10" stroke="${C.river}" stroke-width="1.6" fill="none"/>`, what: 'Blue shows sea, lakes, reservoirs and the larger rivers. Water features are some of the best checkpoints because their shapes are distinctive.', todo: 'Choose large, unique water shapes as checkpoints. Small rivers are hard to see from height, especially in summer.' },
    { id: 'town', grp: 'Topography', name: 'Towns & built-up areas', mini: m => `<path d="M5,6 L30,4 L36,16 L14,20 Z" fill="${C.town}" stroke="${C.townE}" stroke-width=".8"/>`, what: 'Yellow areas show the outline of towns and cities. Their shape helps you identify them from the air.', todo: 'Over a congested area SERA.5005(f) needs at least 1,000 ft above the highest obstacle within 600 m (and enough height to glide clear if the engine stops).' },
    { id: 'roads', grp: 'Topography', name: 'Roads & railways', mini: m => `<path d="M2,8 L38,12" stroke="${C.road}" stroke-width="1.8"/><path d="M2,18 L38,18" stroke="${C.ink}" stroke-width="1.2"/><path d="M8,16V20M16,16V20M24,16V20M32,16V20" stroke="${C.ink}" stroke-width=".7"/>`, what: 'Main roads and motorways (red here) and railways (black with ticks). They are line features you can follow.', todo: 'Use them to confirm position, not as your only reference. UK airmanship: keep a line feature on your left so opposite-direction traffic doing the same passes safely.' },
    { id: 'classA', grp: 'Airspace', name: 'Class A (airways & TMAs)', mini: m => `<path d="M2,12H38" stroke="${C.mag}" stroke-width="6" stroke-opacity=".45"/><path d="M2,9H38" stroke="${C.mag}" stroke-width="1.6"/><text x="20" y="21" ${FONT} font-size="6" text-anchor="middle" fill="${C.mag}" font-weight="bold">A FL55+</text>`, what: 'Magenta boundary with a tint band inside. Class A is IFR only: no VFR flight at all. Labels give the base and top, e.g. "FL55+" means from FL55 up to FL195 (the + means the top is FL195).', todo: 'Stay below the base or go around. A microlight on an NPPL can never enter Class A. Work out where the base changes along your route (narrow tint bands show level changes).' },
    { id: 'classD_ctr', grp: 'Airspace', name: 'Class D control zone (CTR) from the surface', mini: m => `<rect x="3" y="3" width="34" height="18" fill="${C.pink}" stroke="${C.blue}" stroke-width="1.6"/><text x="20" y="15" ${FONT} font-size="6" text-anchor="middle" fill="${C.blue}" font-weight="bold">CTR D SFC</text>`, what: 'Blue boundary with blue tint, and a pink fill because it starts at the surface. A control zone protects a busy airport. Label example: "CTR D SFC-2500\'" = Class D from the surface to 2,500 ft ALT.', todo: 'You need an ATC clearance before entering ("cleared" must be heard), two-way radio, and VMC. Call about 10 minutes before the boundary, read back the clearance and have a plan B route round it. Without a clearance stay out.' },
    { id: 'classD_cta', grp: 'Airspace', name: 'Class D control area (CTA) with a base', mini: m => `<path d="M2,12H38" stroke="${C.blue}" stroke-width="6" stroke-opacity=".35"/><path d="M2,9H38" stroke="${C.blue}" stroke-width="1.6"/><text x="20" y="21" ${FONT} font-size="6" text-anchor="middle" fill="${C.blue}" font-weight="bold">D 1500'-3500'</text>`, what: 'Blue boundary and tint band but no pink fill, because it does not reach the ground. "CTA D 1500\'-3500\'" means Class D from 1,500 ft ALT to 3,500 ft ALT. Below 1,500 ft is outside it (usually Class G).', todo: 'Either get a clearance to enter, or stay below the base with a margin (on the QNH of an aerodrome under that airspace). Remember your altimeter error and the terrain under you.' },
    { id: 'classE', grp: 'Airspace', name: 'Class E', mini: m => `<path d="M2,12H38" stroke="${C.blueT}" stroke-width="6" stroke-opacity=".5" stroke-dasharray="7 3"/><text x="20" y="21" ${FONT} font-size="6" text-anchor="middle" fill="${C.blue}" font-weight="bold">E 2000'-6000'</text>`, what: 'Controlled airspace where IFR traffic is controlled but VFR flights do not need a clearance. In the UK it is uncommon at low level. Some Class E is also a TMZ, so a transponder may still be required.', todo: 'VFR: VMC minima of 5 km, 1,500 m horizontally and 1,000 ft vertically from cloud apply. Check whether it is also a TMZ or RMZ. A Basic or Traffic Service from the local unit is wise.' },
    { id: 'rmz', grp: 'Airspace', name: 'Radio Mandatory Zone (RMZ)', mini: m => scallops([[3, 6], [37, 6], [37, 20], [3, 20]], 6, C.blue), what: 'Blue scalloped border. You must carry and use a radio inside: call the controlling unit before entering (state callsign, type, position, level and intentions) and keep listening while inside. It is NOT a clearance zone: the airspace class (often G) still applies.', todo: 'Make the call before the boundary and get two-way contact. If you cannot, stay out. Note the unit and frequency from the chart/AIP. Details: UK AIP GEN 1.5 and ENR 2.2.' },
    { id: 'tmz', grp: 'Airspace', name: 'Transponder Mandatory Zone (TMZ)', mini: m => scallops([[3, 6], [37, 6], [37, 20], [3, 20]], 6, C.mag), what: 'Magenta scalloped border. Aircraft inside must carry and operate a serviceable SSR transponder (Mode S where specified), with altitude reporting. An RMZ/TMZ has alternating blue and magenta scallops and needs both.', todo: 'Switch the transponder to ALT before you reach the boundary. With no transponder you must get permission from the controlling unit first, or route round. Details: UK AIP ENR 1.6 and ENR 2.2.' },
    { id: 'atz', grp: 'Airspace', name: 'Aerodrome Traffic Zone (ATZ)', mini: m => `<circle cx="20" cy="12" r="9" fill="${C.pink}" stroke="${C.mag}" stroke-width="2.4" stroke-dasharray="0 4.5" stroke-linecap="round"/>`, what: 'Magenta dotted circle (pink fill = from the surface). Surface to 2,000 ft above aerodrome level, radius 2 NM from the mid-point of the longest runway (2.5 NM if that runway is longer than 1,850 m). Rule 11 of the Rules of the Air 2015 applies during notified hours.', todo: 'ATC unit: get permission. AFIS: get information. Air/Ground: get information. Report position and height when you enter and before you leave. ATZs entirely inside controlled airspace are not drawn, so a field inside a CTR may still have one. Frequencies are in the chart\'s ATZ table and the AIP.' },
    { id: 'matz', grp: 'Airspace', name: 'Military ATZ (MATZ)', mini: m => `<circle cx="16" cy="12" r="9" fill="${C.blueT}" fill-opacity=".25" stroke="${C.blue}" stroke-width="2.2" stroke-dasharray="0 4.5" stroke-linecap="round"/><rect x="24" y="9" width="14" height="6" fill="${C.blueT}" fill-opacity=".25" stroke="${C.blue}" stroke-width="1.5" stroke-dasharray="0 3.5" stroke-linecap="round"/>`, what: 'Blue dotted outline. Usually the surface to 3,000 ft above aerodrome level within 5 NM, plus stubs (about 4 NM wide and 5 NM long) from 1,000 ft to 3,000 ft AAL. The frequency box shows the penetration frequency, and "LARS" if that unit gives a Lower Airspace Radar Service.', todo: 'A MATZ is not compulsory for civil pilots, but you are strongly advised to call 15 NM or 5 minutes out and ask for a "MATZ penetration", then follow the instructions. The ATZ in the middle IS compulsory (Rule 11).' },
    { id: 'danger', grp: 'Airspace', name: 'Danger Area (solid boundary)', mini: m => `<rect x="3" y="4" width="34" height="16" fill="none" stroke="${C.red}" stroke-width="1.5"/><rect x="5" y="6" width="30" height="12" fill="none" stroke="${C.red}" stroke-width="3" stroke-dasharray="1 2" stroke-opacity=".7"/><text x="20" y="15" ${FONT} font-size="6" text-anchor="middle" fill="${C.red}" font-weight="bold">D123/5.0</text>`, what: 'Red boundary with hatching inside. "D123/5.0" = Danger Area 123, active up to 5,000 ft AMSL. Firing ranges, test sites and similar. A solid line means it has scheduled activity times (see UK AIP ENR 5.1).', todo: 'Find out whether it is active: use the Danger Area Crossing Service (DACS) or Activity Information Service (DAAIS/SUAAIS) frequency on the chart legend, or the pre-flight phone number. If you get no reply, assume it is active and avoid it.' },
    { id: 'danger_notam', grp: 'Airspace', name: 'Danger Area active by NOTAM (broken boundary)', mini: m => `<rect x="3" y="4" width="34" height="16" fill="none" stroke="${C.red}" stroke-width="1.5" stroke-dasharray="4 2.5"/><text x="20" y="15" ${FONT} font-size="6" text-anchor="middle" fill="${C.red}" font-weight="bold">D124/2.0</text>`, what: 'A broken (dashed) boundary means the area is only active when a NOTAM says so.', todo: 'Check the NOTAMs (and the Navigation Warnings) for the day of flight. If it is notified active, stay out.' },
    { id: 'restricted', grp: 'Airspace', name: 'Restricted Area (R)', mini: m => `<rect x="3" y="4" width="34" height="16" fill="none" stroke="${C.red}" stroke-width="1.5"/><text x="20" y="15" ${FONT} font-size="6" text-anchor="middle" fill="${C.red}" font-weight="bold">R105/2.2</text>`, what: 'Flight is restricted by law according to conditions in the UK AIP ENR 5.1 (for example only with permission, or only at certain times). R105/2.2 = up to 2,200 ft AMSL. Temporary restrictions (RA(T)) are published by AIC and NOTAM.', todo: 'Read the conditions in ENR 5.1 and stay out unless you meet them. Check for RA(T)s on every flight: royal flights, air displays and events create them at short notice.' },
    { id: 'prohibited', grp: 'Airspace', name: 'Prohibited Area (P)', mini: m => `<circle cx="20" cy="12" r="8" fill="none" stroke="${C.red}" stroke-width="1.6"/><text x="20" y="14.5" ${FONT} font-size="6" text-anchor="middle" fill="${C.red}" font-weight="bold">P106</text>`, what: 'No flight at all within the stated limits (for example over some sensitive sites).', todo: 'Never enter. Plan your track to stay well clear, allowing for drift and navigation error.' },
    { id: 'civil_ad', grp: 'Aerodromes', name: 'Civil aerodrome', mini: m => S.civil(20, 12), what: 'Blue circle with four ticks: a civil aerodrome. The number next to it is the elevation in feet AMSL. Name in capitals.', todo: 'Check the UK AIP (or the strip\'s own website) for PPR, hours, radio and circuit procedures before you go. Portrayal does not give you any right to land without permission.' },
    { id: 'civil_ltd', grp: 'Aerodromes', name: 'Civil aerodrome, limited or no facilities', mini: m => S.civilLtd(20, 12), what: 'Plain blue circle: a civil aerodrome with limited or no facilities, where flying training may be taking place.', todo: 'Expect non-radio or training traffic. Get PPR, and if there is no radio service, broadcast your intentions and join with great care.' },
    { id: 'training', grp: 'Aerodromes', name: 'Training aerodrome (T)', mini: m => S.training(18, 11), what: 'A "T" by the symbol means flight training, including circuit training, takes place there (UK AIP ENR 1.1 & ENR 5.5).', todo: 'Expect busy circuits and students. Avoid the overhead and circuit unless you are joining, and call them if you are passing nearby.' },
    { id: 'military_ad', grp: 'Aerodromes', name: 'Government (military) aerodrome', mini: m => S.military(20, 12), what: 'Magenta double circle. A government aerodrome. Most have an H24 ATZ and many a MATZ.', todo: 'Do not land without permission (except in an emergency). Call for a MATZ penetration service and observe the ATZ.' },
    { id: 'heliport', grp: 'Aerodromes', name: 'Heliport (H)', mini: m => S.heli(20, 12), what: 'Blue H in a circle: a civil heliport. A magenta one is a government heliport.', todo: 'Expect helicopters arriving and leaving at low level from any direction.' },
    { id: 'microlight', grp: 'Aerodromes', name: 'Microlight flying site (M)', mini: m => S.micro(20, 12), what: 'Blue M in a circle. Intense microlight activity also happens at some other licensed and unlicensed aerodromes (UK AIP ENR 1.1 & ENR 5.5).', todo: 'Expect slow aircraft in the circuit, often without radio. Always get PPR before landing at a farm strip.' },
    { id: 'glider', grp: 'Aerodromes', name: 'Glider launching site (G/2.5)', mini: m => S.glider(16, 10), what: 'G in a circle. The figure after the slash is the maximum altitude of the winch cable in thousands of feet AMSL: "/2.5" = cable up to 2,500 ft AMSL (2,000 ft above the site plus its elevation).', todo: 'Never fly over a winch site below the figure shown: the cable is almost invisible. Expect gliders above and around it too, and in thermals nearby.' },
    { id: 'para', grp: 'Aerodromes', name: 'Free-fall parachuting drop zone', mini: m => S.para(20, 12), what: 'Parachute in a circle. Parachutists may be falling anywhere within 1.5 or 2 NM of the drop zone up to FL150. Drop aircraft squawk 0033 from five minutes before the drop.', todo: 'Avoid the circle. If you must pass close, call the drop zone frequency or the local ATSU first.' },
    { id: 'disused', grp: 'Aerodromes', name: 'Disused aerodrome', mini: m => S.disused(20, 12), what: 'Circle with an X: disused or abandoned aerodrome, shown only as a landmark.', todo: 'Use it as a checkpoint. It may be a forced-landing option, but the surface may be blocked or built on. Do not land there normally.' },
    { id: 'customs', grp: 'Aerodromes', name: 'Customs aerodrome (pecked box round the name)', mini: m => `<rect x="3" y="6" width="34" height="12" fill="none" stroke="${C.blue}" stroke-width="1" stroke-dasharray="3 2"/><text x="20" y="14.5" ${FONT} font-size="6" text-anchor="middle" fill="${C.blue}" font-weight="bold">KESTON</text>`, what: 'A pecked line around the name and elevation marks an aerodrome with customs facilities.', todo: 'For international flights, check the current Border Force/GAR requirements and the aerodrome\'s customs hours.' },
    { id: 'vrp', grp: 'Navigation & radio', name: 'Visual Reference Point (VRP)', mini: m => S.vrp(8, 12) + `<rect x="13" y="7" width="26" height="10" fill="#fff" stroke="${C.blue}" stroke-width=".8"/><text x="26" y="14" ${FONT} font-size="5" text-anchor="middle" fill="${C.blue}">VRP</text>`, what: 'Circle with a cross plus a boxed name: a point notified in the UK AIP that ATC use for VFR routing round controlled airspace (for example "report at TOWER FARM").', todo: 'Learn the VRPs around any CTR you plan to enter or pass. When ATC ask you to report or hold at one, you need to recognise it from the air.' },
    { id: 'obst', grp: 'Navigation & radio', name: 'Obstacle (unlighted)', mini: m => S.obst(10, 14) + `<text x="16" y="12" ${FONT} font-size="6" font-style="italic" fill="${C.blue}">612</text><text x="16" y="19" ${FONT} font-size="5.5" fill="${C.blue}">(350)</text>`, what: 'Inverted V with a dot. The italic figure is the top of the obstacle in feet AMSL (612) and the figure in brackets is its height above the local ground (350). The chart shows land obstacles 100 m (328 ft) AGL and above, and a few lower ones as landmarks.', todo: 'Compare the italic AMSL figure with your altitude on QNH. Keep at least 500 ft clear (more in poor visibility). Masts and guy wires are very hard to see.' },
    { id: 'obst_lit', grp: 'Navigation & radio', name: 'Lighted / multiple obstacles & cables', mini: m => S.obstLit(8, 16) + S.obstLit(16, 16) + `<path d="M8,19 L16,19" stroke="${C.blue}" stroke-width=".8" stroke-dasharray="1.5 1"/><text x="20" y="14" ${FONT} font-size="6" font-style="italic" fill="${C.blue}">1256</text>`, what: 'Rays above the symbol mean the obstacle is lit. Several symbols together mark a group, and a line joining them marks cables between them. Groups shown lit or unlit may be a mixture.', todo: 'Treat the highest figure in the group as the hazard and remember cables are invisible.' },
    { id: 'obst_high', grp: 'Navigation & radio', name: 'Exceptionally high obstacle (1,000 ft AGL or more)', mini: m => S.obstHigh(9, 15) + `<text x="16" y="12" ${FONT} font-size="6" font-style="italic" fill="${C.blue}">1678</text><text x="16" y="19" ${FONT} font-size="5.5" fill="${C.blue}">(1031)</text>`, what: 'Solid symbol with light rays: an exceptionally high lighted obstacle 1,000 ft or more above ground level.', todo: 'These masts often have guy wires a long way out. Plan your minimum safe altitude well above them, or route round.' },
    { id: 'turbine', grp: 'Navigation & radio', name: 'Wind turbines / wind farm', mini: m => S.turbine(10, 14) + S.turbine(18, 14) + S.turbine(26, 14), what: 'Three-bladed symbol. A single turbine or a group (wind farm), with elevation AMSL in italics and height AGL in brackets.', todo: 'Keep well clear: there is turbulence downwind and the blades are hard to see edge-on. Large wind farms can also clutter radar.' },
    { id: 'navaid', grp: 'Navigation & radio', name: 'Radio nav aids (VOR, NDB)', mini: m => S.vor(12, 12) + S.ndb(29, 12), what: 'Hexagon = VOR (with a compass rose oriented on magnetic north). Dotted circles = NDB. A box round a VOR means a co-located DME. Name, ident and frequency are printed next to them.', todo: 'They are useful landmarks and for position fixes. They also often mark busy IFR routes, so keep a good lookout near them.' },
    { id: 'freq', grp: 'Navigation & radio', name: 'Frequency boxes (ATZ table, LARS, FIS)', mini: m => `<rect x="2" y="6" width="36" height="12" fill="#fff" stroke="${C.blue}" stroke-width=".8"/><text x="20" y="14" ${FONT} font-size="5.5" text-anchor="middle" fill="${C.blue}">LARS 125.555</text>`, what: 'MATZ boxes show the penetration frequency and "LARS" if the unit gives a radar service. ATZ frequencies are listed in a table on the chart. LARS units give a Basic or Traffic Service up to FL95 within about 30 NM (chart legend; UK AIP ENR 1.6).', todo: 'Write the frequencies for each leg on your plog before you go and check them against the UK AIP or the aerodrome plate. Frequencies change. The ones on this sample are invented.' },
    { id: 'asr', grp: 'Navigation & radio', name: 'Altimeter Setting Region boundary', mini: m => `<path d="M2,12H38" stroke="${C.blueT}" stroke-width="1.2"/><path d="M8,8V16M4,12H12M22,8V16M18,12H26M34,8V16M30,12H38" stroke="${C.blueT}" stroke-width="1.6"/>`, what: 'A row of crosses separates Altimeter Setting Regions. Each region has a forecast Regional Pressure Setting (RPS), the lowest forecast QNH for the hour.', todo: 'Below the transition altitude en route use the RPS (or a nearby aerodrome QNH). Under and inside a CTR/TMA use the QNH of an aerodrome under that airspace, as the chart note and UK AIP ENR 1.7 say.' },
    { id: 'bird', grp: 'Navigation & radio', name: 'Bird sanctuary', mini: m => S.bird(20, 12), what: 'Bird in a circle with name/effective altitude in thousands of feet. Pilots are asked to avoid these areas during the periods in UK AIP ENR 5.6.', todo: 'Route around or above the stated altitude. A bird strike on a microlight windscreen or propeller can be serious.' },
    { id: 'hirta', grp: 'Navigation & radio', name: 'High Intensity Radio Transmission Area (HIRTA)', mini: m => S.hirta(20, 12), what: 'Gridded circle: strong radio transmissions that can interfere with avionics and, close in, be harmful. Effective altitude in thousands of feet (UK AIP ENR 5.3).', todo: 'Avoid flying through it below the stated altitude.' }
  ];
  const BY = {}; L.forEach(i => BY[i.id] = i);

  /* ---------- the sample map ---------- */
  function feat(id, inner) { return `<g data-f="${id}" class="vc-f">${inner}</g>`; }

  function buildMap(p) {
    let s = '';
    s += `<defs>
      <pattern id="${p}hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="none"/><line x1="0" y1="0" x2="0" y2="4" stroke="${C.red}" stroke-width="1.6"/></pattern>
      <clipPath id="${p}ctr"><path d="M380,290 L470,285 L492,330 L470,382 L392,386 L366,338 Z"/></clipPath>
      <clipPath id="${p}cta"><path d="M340,262 L500,252 L536,330 L506,412 L360,420 L320,340 Z"/></clipPath>
      <clipPath id="${p}tma"><path d="M520,0 L640,0 L640,190 L560,170 Z"/></clipPath>
      <clipPath id="${p}d123"><path d="M285,120 L345,112 L360,160 L318,186 L278,165 Z"/></clipPath>
      <clipPath id="${p}e"><path d="M520,410 L640,380 L640,480 L540,480 Z"/></clipPath>
    </defs>`;
    // land + sea
    s += `<rect width="${W}" height="${H}" fill="${C.land}"/>`;
    s += feat('water', `<path d="M0,395 C40,388 70,410 110,420 C150,430 170,452 220,458 C260,463 280,480 290,480 L0,480 Z" fill="${C.water}"/>
      <path d="M0,395 C40,388 70,410 110,420 C150,430 170,452 220,458 C260,463 280,480 290,480" fill="none" stroke="${C.river}" stroke-width="1"/>
      <path d="M640,230 C600,236 575,262 548,268 C520,276 505,300 470,312 C440,322 420,350 380,356 C340,362 300,390 250,400 C215,407 190,430 170,442" fill="none" stroke="${C.river}" stroke-width="2"/>
      <path d="M232,214 C246,206 262,210 266,220 C270,232 254,240 240,236 C228,232 224,220 232,214 Z" fill="${C.water}" stroke="${C.river}" stroke-width=".8"/>
      ${label(249, 246, 'Holm Water', { size: 4.5, fill: C.river, italic: true })}${label(560, 263, 'R. Wend', { size: 4.5, fill: C.river, italic: true, rotate: -15 })}${label(60, 450, 'BRANSEA BAY', { size: 6, fill: C.river, italic: true })}`);
    // terrain
    s += feat('terrain', `<path d="M380,40 C420,20 520,30 560,70 C600,110 590,170 540,190 C500,206 430,196 400,170 C370,140 350,70 380,40 Z" fill="${C.t1}" stroke="${C.cont}" stroke-width=".6"/>
      <path d="M410,60 C440,45 510,55 535,85 C560,115 548,160 515,170 C480,180 440,170 420,148 C400,125 390,75 410,60 Z" fill="${C.t2}" stroke="${C.cont}" stroke-width=".6"/>
      <path d="M445,85 C465,75 500,82 512,100 C524,120 512,145 490,148 C468,151 452,140 446,124 C440,108 436,92 445,85 Z" fill="${C.t3}" stroke="${C.cont}" stroke-width=".6"/>
      <path d="M40,40 C70,25 120,35 128,58 C134,78 110,92 80,90 C55,88 30,62 40,40 Z" fill="${C.t1}" stroke="${C.cont}" stroke-width=".6"/>
      ${label(398, 58, '500', { size: 3.5, fill: C.cont })}${label(424, 74, '1000', { size: 3.5, fill: C.cont })}${label(458, 92, '1500', { size: 3.5, fill: C.cont })}${label(470, 186, 'HARROW DOWNS', { size: 6, fill: '#6d5532', weight: 'bold' })}`);
    s += feat('spot', S.spot(482, 116) + label(495, 118, '1643', { size: 5.5 }) + S.spot(86, 60) + label(97, 62, '712', { size: 5.5 }) + S.spot(560, 120) + label(571, 122, '904', { size: 5.5 }) + S.spot(220, 330) + label(229, 332, '262', { size: 4.5 }));
    // towns, roads, rail
    s += feat('town', `<path d="M418,312 L452,306 L462,330 L446,346 L420,340 Z" fill="${C.town}" stroke="${C.townE}" stroke-width=".7"/>${label(440, 355, 'Keston', { size: 6.5, weight: 'bold' })}
      <path d="M150,300 L176,296 L184,318 L160,326 Z" fill="${C.town}" stroke="${C.townE}" stroke-width=".7"/>${label(166, 334, 'Marbury', { size: 6, weight: 'bold' })}
      <path d="M560,330 L576,326 L582,340 L566,346 Z" fill="${C.town}" stroke="${C.townE}" stroke-width=".7"/>${label(571, 354, 'Hawley', { size: 5 })}
      <circle cx="300" cy="230" r="3" fill="${C.town}" stroke="${C.townE}" stroke-width=".5"/>${label(300, 225, 'Ashlea', { size: 4.5 })}
      <circle cx="350" cy="420" r="3" fill="${C.town}" stroke="${C.townE}" stroke-width=".5"/>${label(350, 432, 'Fenby', { size: 4.5 })}`);
    s += feat('roads', `<path d="M0,280 C80,290 140,300 170,310 C240,330 330,318 430,326 C500,332 560,336 640,340" fill="none" stroke="${C.road}" stroke-width="2"/>
      <path d="M440,330 C430,250 400,210 330,180 C280,160 200,120 150,0" fill="none" stroke="${C.road}" stroke-width="1.2"/>
      <path d="M0,350 C100,350 180,360 250,372 C330,386 420,370 640,300" fill="none" stroke="${C.ink}" stroke-width="1"/>
      <path d="M0,350 C100,350 180,360 250,372 C330,386 420,370 640,300" fill="none" stroke="${C.ink}" stroke-width="3" stroke-dasharray=".6 7"/>
      ${label(90, 280, 'M47', { size: 5, fill: C.road, weight: 'bold' })}`);
    // graticule + MEF
    let g = '';
    [90, 390].forEach((y, i) => { g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#6a6a8a" stroke-width=".6"/>` + label(4, y - 2, ['52°00\'N', '51°30\'N'][i], { size: 5, anchor: 'start', fill: '#4a4a6a' }); for (let x = 0; x < W; x += 10) g += `<line x1="${x}" y1="${y - 1.5}" x2="${x}" y2="${y + 1.5}" stroke="#6a6a8a" stroke-width=".4"/>`; });
    [40, 225, 410, 595].forEach((x, i) => { g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#6a6a8a" stroke-width=".6"/>` + label(x + 2, 8, ['2°00\'W', '1°30\'W', '1°00\'W', '0°30\'W'][i], { size: 5, anchor: 'start', fill: '#4a4a6a' }); for (let y = 0; y < H; y += 10) g += `<line x1="${x - 1.5}" y1="${y}" x2="${x + 1.5}" y2="${y}" stroke="#6a6a8a" stroke-width=".4"/>`; });
    s += feat('graticule', g);
    const mef = (x, y, a, b) => `<text x="${x}" y="${y}" ${FONT} font-size="30" font-weight="bold" fill="${C.blue}" fill-opacity=".8">${a}</text><text x="${x + 17}" y="${y - 14}" ${FONT} font-size="15" font-weight="bold" fill="${C.blue}" fill-opacity=".8">${b}</text>`;
    s += feat('mef', mef(110, 250, 1, 0) + mef(290, 300, 1, 0) + mef(475, 240, 2, 0) + mef(600, 50, 2, 0) + mef(60, 34, 1, 1));
    // isogonal
    s += feat('isogonal', `<path d="M250,0 C270,160 300,320 330,480" fill="none" stroke="${C.mag}" stroke-width="1" stroke-dasharray="6 3"/>${label(262, 60, '1°W', { size: 6, fill: C.mag, rotate: 80 })}${label(318, 420, '1°W', { size: 6, fill: C.mag, rotate: 78 })}`);
    // ASR
    let asr = `<path d="M0,190 L230,200" stroke="${C.blueT}" stroke-width=".8"/>`; for (let x = 8; x < 230; x += 22) { const y = 190 + x * 10 / 230; asr += `<path d="M${x - 4},${y.toFixed(1)}H${x + 4}M${x},${(y - 4).toFixed(1)}V${(y + 4).toFixed(1)}" stroke="${C.blueT}" stroke-width="1.3"/>`; }
    s += feat('asr', asr + label(60, 184, 'WOLD ASR', { size: 5, fill: C.blue }) + label(60, 204, 'SOLENT ASR', { size: 5, fill: C.blue }));
    // Class A TMA corner + airway
    s += feat('classA', `<g clip-path="url(#${p}tma)"><path d="M520,0 L560,170 L640,190" fill="none" stroke="${C.mag}" stroke-width="14" stroke-opacity=".38"/></g><path d="M520,0 L560,170 L640,190" fill="none" stroke="${C.mag}" stroke-width="1.6"/>${label(598, 150, 'TMA', { size: 6, fill: C.mag, weight: 'bold' })}<rect x="583" y="154" width="9" height="8" fill="${C.mag}"/>${label(587.5, 160.5, 'A', { size: 6, fill: '#fff', weight: 'bold', halo: false })}${label(612, 161, '3500\'+', { size: 6, fill: C.mag, weight: 'bold' })}
      <path d="M0,150 L300,0" stroke="${C.mag}" stroke-width="22" stroke-opacity=".16"/><path d="M0,138 L276,0 M0,162 L324,0" stroke="${C.mag}" stroke-width="1.2"/>${label(150, 78, 'L10', { size: 6, fill: C.mag, weight: 'bold', rotate: -26.5 })}<g transform="rotate(-26.5 166 70)"><rect x="162" y="64" width="9" height="8" fill="${C.mag}"/>${label(166.5, 70.5, 'A', { size: 6, fill: '#fff', weight: 'bold', halo: false })}</g>${label(186, 61, 'FL55+', { size: 6, fill: C.mag, weight: 'bold', rotate: -26.5 })}`);
    // Class D CTA + CTR
    s += feat('classD_cta', `<g clip-path="url(#${p}cta)"><path d="M340,262 L500,252 L536,330 L506,412 L360,420 L320,340 Z" fill="none" stroke="${C.blue}" stroke-width="12" stroke-opacity=".3"/></g><path d="M340,262 L500,252 L536,330 L506,412 L360,420 L320,340 Z" fill="none" stroke="${C.blue}" stroke-width="1.6"/>${label(372, 274, 'KESTON CTA', { size: 5.5, fill: C.blue, weight: 'bold', anchor: 'start' })}<rect x="408" y="276" width="8" height="7" fill="${C.blue}"/>${label(412, 281.8, 'D', { size: 5.5, fill: '#fff', weight: 'bold', halo: false })}${label(420, 282, '1500\'-3500\'', { size: 5.5, fill: C.blue, weight: 'bold', anchor: 'start' })}`);
    s += feat('classD_ctr', `<path d="M380,290 L470,285 L492,330 L470,382 L392,386 L366,338 Z" fill="${C.pink}" fill-opacity=".8"/><g clip-path="url(#${p}ctr)"><path d="M380,290 L470,285 L492,330 L470,382 L392,386 L366,338 Z" fill="none" stroke="${C.blue}" stroke-width="10" stroke-opacity=".3"/></g><path d="M380,290 L470,285 L492,330 L470,382 L392,386 L366,338 Z" fill="none" stroke="${C.blue}" stroke-width="1.6"/>${label(398, 376, 'KESTON CTR', { size: 5.5, fill: C.blue, weight: 'bold', anchor: 'start' })}<rect x="436" y="370" width="8" height="7" fill="${C.blue}"/>${label(440, 375.8, 'D', { size: 5.5, fill: '#fff', weight: 'bold', halo: false })}${label(447, 376, 'SFC-2500\'', { size: 5.5, fill: C.blue, weight: 'bold', anchor: 'start' })}`);
    // Class E
    s += feat('classE', `<g clip-path="url(#${p}e)"><path d="M520,410 L640,380" fill="none" stroke="${C.blueT}" stroke-width="12" stroke-opacity=".5" stroke-dasharray="10 4"/><path d="M520,410 L540,480" fill="none" stroke="${C.blueT}" stroke-width="12" stroke-opacity=".5" stroke-dasharray="10 4"/></g><path d="M520,410 L640,380 M520,410 L540,480" fill="none" stroke="${C.blue}" stroke-width=".8" stroke-dasharray="6 3"/>${label(575, 430, 'TMA', { size: 5.5, fill: C.blue, weight: 'bold' })}<rect x="586" y="424" width="8" height="7" fill="${C.blue}"/>${label(590, 429.8, 'E', { size: 5.5, fill: '#fff', weight: 'bold', halo: false })}${label(612, 430, '2000\'-6000\'', { size: 5.5, fill: C.blue, weight: 'bold' })}`);
    // RMZ around Hawley + TMZ near TMA
    const rmz = [[545, 296], [610, 290], [626, 350], [600, 376], [548, 370]];
    s += feat('rmz', `<polygon points="${pts(rmz)}" fill="none" stroke="${C.blue}" stroke-width=".6"/>${scallops(rmz, 7, C.blue)}${label(590, 312, 'HAWLEY RMZ', { size: 5, fill: C.blue, weight: 'bold' })}${label(590, 319, 'SFC-3500\'', { size: 5, fill: C.blue, weight: 'bold' })}${label(590, 326, 'Hawley Radar 120.630', { size: 4, fill: C.blue })}`);
    const tmz = [[560, 196], [640, 214], [640, 262], [590, 254]];
    s += feat('tmz', `<polygon points="${pts(tmz)}" fill="none" stroke="${C.mag}" stroke-width=".6"/>${scallops(tmz, 7, C.mag)}${label(608, 232, 'TMZ', { size: 5.5, fill: C.mag, weight: 'bold' })}${label(608, 240, '1500\'-FL100', { size: 5, fill: C.mag, weight: 'bold' })}`);
    // MATZ with stub around RAF Wexcombe (150,110)
    s += feat('matz', `<path d="M193.3,135 A50,50 0 1 1 182.1,148.3 L214.1,186.6 L241.3,163.6 L193.3,135" fill="${C.blueT}" fill-opacity=".14" stroke="${C.blue}" stroke-width="2.3" stroke-dasharray="0 5" stroke-linecap="round"/><rect x="182" y="40" width="58" height="17" fill="#fff" stroke="${C.blue}" stroke-width=".7"/>${label(211, 47, 'WEXCOMBE MATZ', { size: 4.5, fill: C.blue, weight: 'bold', halo: false })}${label(211, 54, 'LARS 125.555', { size: 4.5, fill: C.blue, halo: false })}`);
    s += feat('freq', `<rect x="182" y="40" width="58" height="17" fill="none" stroke="${C.blue}" stroke-width="1.2"/><rect x="8" y="420" width="96" height="44" fill="#fff" stroke="${C.blue}" stroke-width=".7"/>${label(56, 428, 'ATZ FREQUENCIES (sample)', { size: 4.5, fill: C.blue, weight: 'bold', halo: false })}${label(12, 437, 'OAKBURY      A/G  122.455', { size: 4.2, anchor: 'start', fill: C.blue, halo: false })}${label(12, 445, 'WEXCOMBE   APP  125.555', { size: 4.2, anchor: 'start', fill: C.blue, halo: false })}${label(12, 453, 'KESTON        TWR 118.705', { size: 4.2, anchor: 'start', fill: C.blue, halo: false })}${label(12, 461, 'All invented — not for use', { size: 3.8, anchor: 'start', fill: '#666', halo: false })}`);
    // ATZs (not drawn for Keston: inside CTR)
    s += feat('atz', `<circle cx="150" cy="110" r="20" fill="${C.pink}" fill-opacity=".9" stroke="${C.mag}" stroke-width="2.2" stroke-dasharray="0 4.6" stroke-linecap="round"/><circle cx="196" cy="252" r="20" fill="${C.pink}" fill-opacity=".9" stroke="${C.mag}" stroke-width="2.2" stroke-dasharray="0 4.6" stroke-linecap="round"/>`);
    // danger / restricted / prohibited
    s += feat('danger', `<g clip-path="url(#${p}d123)"><path d="M285,120 L345,112 L360,160 L318,186 L278,165 Z" fill="none" stroke="url(#${p}hatch)" stroke-width="10"/></g><path d="M285,120 L345,112 L360,160 L318,186 L278,165 Z" fill="none" stroke="${C.red}" stroke-width="1.4"/>${label(318, 150, 'D123/5.0', { size: 6.5, fill: C.red, weight: 'bold' })}`);
    s += feat('danger_notam', `<circle cx="96" cy="300" r="18" fill="none" stroke="${C.red}" stroke-width="1.4" stroke-dasharray="5 3"/>${label(96, 302, 'D124/2.0', { size: 5.5, fill: C.red, weight: 'bold' })}`);
    s += feat('restricted', `<rect x="208" y="388" width="36" height="22" fill="none" stroke="${C.red}" stroke-width="1.4"/><rect x="210" y="390" width="32" height="18" fill="none" stroke="url(#${p}hatch)" stroke-width="3" stroke-opacity=".7"/>${label(226, 402, 'R105/2.2', { size: 5, fill: C.red, weight: 'bold' })}`);
    s += feat('prohibited', `<circle cx="526" cy="226" r="9" fill="none" stroke="${C.red}" stroke-width="1.4"/><circle cx="526" cy="226" r="7" fill="none" stroke="url(#${p}hatch)" stroke-width="3"/>${label(526, 242, 'P106/2.0', { size: 4.5, fill: C.red, weight: 'bold' })}`);
    // aerodromes
    s += feat('military_ad', S.military(150, 110) + label(150, 128, 'WEXCOMBE', { size: 5.5, fill: C.mag, weight: 'bold' }) + label(150, 135, '420', { size: 4.5, fill: C.mag }));
    s += feat('civil_ad', S.civil(196, 252) + label(196, 270, 'OAKBURY', { size: 5.5, fill: C.blue, weight: 'bold' }) + label(196, 277, '250', { size: 4.5, fill: C.blue }) + S.civil(430, 324) + label(430, 297, 'KESTON', { size: 5.5, fill: C.blue, weight: 'bold' }) + label(430, 304, '257', { size: 4.5, fill: C.blue }));
    s += feat('training', `<text x="203" y="261" ${FONT} font-size="6" font-weight="bold" fill="${C.blue}">T</text>`);
    s += feat('customs', `<rect x="413" y="291" width="34" height="15" fill="none" stroke="${C.blue}" stroke-width=".8" stroke-dasharray="2.5 1.5"/><rect x="413" y="291" width="34" height="15" fill="none" stroke="transparent" stroke-width="5" pointer-events="stroke"/>`);
    s += feat('civil_ltd', S.civilLtd(520, 446) + label(520, 461, 'MILL FARM', { size: 5, fill: C.blue, weight: 'bold' }) + label(520, 467, '95', { size: 4.5, fill: C.blue }));
    s += feat('heliport', S.heli(455, 352) + label(468, 364, 'KESTON HOSPITAL', { size: 3.8, fill: C.blue, anchor: 'start' }));
    s += feat('microlight', S.micro(330, 238) + label(330, 254, 'ASHLEA', { size: 5, fill: C.blue, weight: 'bold' }) + label(330, 260, '310', { size: 4.5, fill: C.blue }));
    s += feat('glider', S.glider(250, 172) + label(250, 194, 'HOLM HILL', { size: 4.5, fill: C.blue, weight: 'bold' }));
    s += feat('para', S.para(372, 444) + label(388, 447, 'FENBY DZ', { size: 4.5, fill: C.blue, anchor: 'start', weight: 'bold' }));
    s += feat('disused', S.disused(60, 340) + label(60, 353, 'Thorne (dis)', { size: 4.2, fill: C.blue }));
    // VRPs
    const vrp = (x, y, n, dx) => S.vrp(x, y) + `<rect x="${x + dx}" y="${y - 10}" width="${n.length * 3.2 + 6}" height="8" fill="#fff" stroke="${C.blue}" stroke-width=".6"/>` + label(x + dx + (n.length * 3.2 + 6) / 2, y - 4, n, { size: 4.2, fill: C.blue, halo: false });
    s += feat('vrp', vrp(358, 300, 'TOWER FARM', -40) + vrp(486, 400, 'FENBY CROSS', 4) + vrp(470, 268, 'MILL LAKE', 4));
    // obstacles
    s += feat('obst', S.obst(236, 316) + label(242, 312, '612', { size: 5, fill: C.blue, italic: true, anchor: 'start' }) + label(242, 319, '(350)', { size: 4.5, fill: C.blue, anchor: 'start' }) + S.obst(122, 214) + label(128, 210, '548', { size: 5, fill: C.blue, italic: true, anchor: 'start' }) + label(128, 217, '(330)', { size: 4.5, fill: C.blue, anchor: 'start' }));
    s += feat('obst_lit', S.obstLit(500, 152) + S.obstLit(510, 156) + `<path d="M500,155 L510,159" stroke="${C.blue}" stroke-width=".7" stroke-dasharray="1.5 1"/>` + label(516, 150, '1256', { size: 5, fill: C.blue, italic: true, anchor: 'start' }) + label(516, 157, '(410)', { size: 4.5, fill: C.blue, anchor: 'start' }) + label(516, 164, 'cables', { size: 3.8, fill: C.blue, anchor: 'start' }));
    s += feat('obst_high', S.obstHigh(618, 100) + label(611, 97, '1678', { size: 5.5, fill: C.blue, italic: true, anchor: 'end' }) + label(611, 105, '(1031)', { size: 4.5, fill: C.blue, anchor: 'end' }));
    s += feat('turbine', S.turbine(600, 410) + S.turbine(610, 404) + S.turbine(618, 414) + S.turbine(607, 420) + label(596, 398, '738', { size: 5, fill: C.blue, italic: true, anchor: 'end' }) + label(596, 405, '(394)', { size: 4.5, fill: C.blue, anchor: 'end' }));
    // nav aids, bird, hirta
    s += feat('navaid', S.vor(300, 300) + `<circle cx="300" cy="300" r="16" fill="none" stroke="${C.blue}" stroke-width=".5"/>` + label(300, 324, 'KESTON KTN', { size: 4.5, fill: C.blue, weight: 'bold' }) + label(300, 330, 'VOR 113.050', { size: 4, fill: C.blue }) + S.ndb(560, 120) + label(560, 136, 'HDN NDB 382', { size: 4, fill: C.blue }));
    s += feat('bird', S.bird(120, 432) + label(140, 436, 'BS/1.5', { size: 4.5, fill: C.blue, anchor: 'start' }));
    s += feat('hirta', S.hirta(76, 230) + label(76, 245, 'HIRTA/1.6', { size: 4.2, fill: C.blue }));
    // scale bar + edition panel
    let sb = `<rect x="440" y="458" width="0" height="0"/>`; sb = `<g>`; for (let i = 0; i < 4; i++) sb += `<rect x="${440 + i * 25}" y="468" width="25" height="3" fill="${i % 2 ? '#fff' : C.ink}" stroke="${C.ink}" stroke-width=".4"/>`; sb += label(440, 466, '0', { size: 4 }) + label(490, 466, '5', { size: 4 }) + label(540, 466, '10 NM', { size: 4 }) + label(490, 478, '1:500,000 style (10 units = 1 NM)', { size: 3.6 }) + '</g>';
    s += feat('scale', sb);
    s += feat('edition', `<rect x="300" y="6" width="210" height="28" fill="#fff" fill-opacity=".93" stroke="${C.blue}" stroke-width=".8"/>${label(405, 15, 'SAMPLE TRAINING MAP — fictional area, NOT FOR NAVIGATION', { size: 4.6, fill: C.red, weight: 'bold', halo: false })}${label(405, 23, 'Symbols after the CAA 1:500,000 legend (2025 legend sheet)', { size: 4.2, fill: C.blue, halo: false })}${label(405, 30, 'A real chart shows its edition no. + validity date here', { size: 4.2, fill: C.blue, halo: false })}`);
    return s;
  }

  /* ---------- widget ---------- */
  function init(host) {
    if (host.dataset.ready) return; host.dataset.ready = '1';
    const p = 'vc' + (++uid) + '_';
    const grps = []; L.forEach(i => { if (!grps.includes(i.grp)) grps.push(i.grp); });
    const chip = i => `<button type="button" class="vc-chip" data-k="${i.id}"><svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">${i.mini()}</svg><span>${i.name}</span></button>`;
    host.innerHTML = `
      <div class="vc-wrap">
        <div class="vc-tools">
          <button type="button" class="vc-btn" data-act="in" aria-label="Zoom in">+</button>
          <button type="button" class="vc-btn" data-act="out" aria-label="Zoom out">−</button>
          <button type="button" class="vc-btn" data-act="reset" aria-label="Reset view">⟲</button>
          <button type="button" class="vc-btn vc-btn-wide" data-act="legend" aria-expanded="false">Legend</button>
          <span class="vc-zoom" aria-live="polite">1×</span>
        </div>
        <div class="vc-stage"><svg class="vc-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interactive sample 1:500,000 style VFR chart (fictional)" text-rendering="geometricPrecision">${buildMap(p)}<g class="vc-boxes"></g></svg></div>
        <div class="vc-info" role="status" aria-live="polite"><strong>Tap any symbol on the map, or any legend item.</strong> Pinch or use + / − to zoom, drag to move.</div>
        <div class="vc-legend" hidden>${grps.map(g => `<div class="vc-lg"><div class="vc-lgh">${g}</div><div class="vc-chips">${L.filter(i => i.grp === g).map(chip).join('')}</div></div>`).join('')}</div>
        <h3 class="vc-allh">All symbols explained</h3>
        <div class="vc-all" tabindex="0">${L.map(i => `<div class="vc-item" data-k="${i.id}"><button type="button" class="vc-item-btn" data-k="${i.id}"><svg viewBox="0 0 40 24" width="48" height="29" aria-hidden="true">${i.mini()}</svg><span>${i.name}</span><em>Show on map</em></button><p>${i.what}</p><p class="vc-do"><b>What you do:</b> ${i.todo}</p></div>`).join('')}</div>
      </div>`;
    const svg = host.querySelector('.vc-svg'), stage = host.querySelector('.vc-stage');
    const info = host.querySelector('.vc-info'), legend = host.querySelector('.vc-legend'), all = host.querySelector('.vc-all');
    const boxes = host.querySelector('.vc-boxes'), zl = host.querySelector('.vc-zoom');
    let vb = { x: 0, y: 0, w: W, h: H }, anim = null;
    const MAXZ = 8;
    function apply() { svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`); zl.textContent = (W / vb.w).toFixed(1).replace(/\.0$/, '') + '×'; host.dataset.zoom = (W / vb.w).toFixed(2); }
    function clamp(v) { v.w = Math.min(W, Math.max(W / MAXZ, v.w)); v.h = v.w * H / W; v.x = Math.min(W - v.w, Math.max(0, v.x)); v.y = Math.min(H - v.h, Math.max(0, v.y)); return v; }
    function animateTo(t) { t = clamp(t); if (anim) cancelAnimationFrame(anim); const s = Object.assign({}, vb), t0 = performance.now(), D = 320; const step = n => { const k = Math.min(1, (n - t0) / D), e = 1 - Math.pow(1 - k, 3); vb = { x: s.x + (t.x - s.x) * e, y: s.y + (t.y - s.y) * e, w: s.w + (t.w - s.w) * e, h: s.h + (t.h - s.h) * e }; apply(); if (k < 1) anim = requestAnimationFrame(step); else anim = null; }; anim = requestAnimationFrame(step); }
    function toWorld(cx, cy) { const r = svg.getBoundingClientRect(); return { x: vb.x + (cx - r.left) / r.width * vb.w, y: vb.y + (cy - r.top) / r.height * vb.h }; }
    function zoomAt(f, wx, wy) { const nw = Math.min(W, Math.max(W / MAXZ, vb.w / f)); const k = nw / vb.w; vb = clamp({ x: wx - (wx - vb.x) * k, y: wy - (wy - vb.y) * k, w: nw, h: nw * H / W }); apply(); }
    host.querySelector('.vc-tools').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
      if (a === 'in' || a === 'out') { const f = a === 'in' ? 1.6 : 1 / 1.6; const nw = vb.w / f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; animateTo({ x: cx - nw / 2, y: cy - nw * H / W / 2, w: nw, h: nw * H / W }); }
      else if (a === 'reset') { clearSel(); animateTo({ x: 0, y: 0, w: W, h: H }); }
      else if (a === 'legend') { legend.hidden = !legend.hidden; b.setAttribute('aria-expanded', String(!legend.hidden)); b.classList.toggle('on', !legend.hidden); }
    });
    // pointer pan / pinch
    const ptrs = new Map(); let start = null, moved = false, downTarget = null;
    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; downTarget = e.target; }
      start = snapshot();
    });
    function snapshot() { const a = [...ptrs.values()]; const r = svg.getBoundingClientRect(); if (a.length >= 2) { const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); const m = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; return { vb: Object.assign({}, vb), d, m, r }; } return a.length ? { vb: Object.assign({}, vb), p: a[0], r } : null; }
    svg.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !start) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const a = [...ptrs.values()], r = start.r;
      if (a.length >= 2 && start.d) {
        moved = true; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), m = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        const f = d / start.d; const nw = Math.min(W, Math.max(W / MAXZ, start.vb.w / f)), nh = nw * H / W;
        const wx = start.vb.x + (start.m.x - r.left) / r.width * start.vb.w, wy = start.vb.y + (start.m.y - r.top) / r.height * start.vb.h;
        vb = clamp({ x: wx - (m.x - r.left) / r.width * nw, y: wy - (m.y - r.top) / r.height * nh, w: nw, h: nh }); apply();
      } else if (a.length === 1 && start.p) {
        const dx = a[0].x - start.p.x, dy = a[0].y - start.p.y; if (Math.hypot(dx, dy) > 6) moved = true;
        if (moved) { vb = clamp({ x: start.vb.x - dx / r.width * start.vb.w, y: start.vb.y - dy / r.height * start.vb.h, w: start.vb.w, h: start.vb.h }); apply(); }
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      if (ptrs.size === 0 && !moved && e.type === 'pointerup') { const f = downTarget && downTarget.closest && downTarget.closest('[data-f]'); if (f) select(f.dataset.f, { from: 'map' }); else clearSel(); }
      start = snapshot();
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => { e.preventDefault(); const w = toWorld(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, w.x, w.y); }, { passive: false });
    svg.addEventListener('dblclick', e => { const w = toWorld(e.clientX, e.clientY); zoomAt(2, w.x, w.y); });

    function clearSel() { svg.classList.remove('vc-dim'); svg.querySelectorAll('.vc-hl').forEach(n => n.classList.remove('vc-hl')); boxes.innerHTML = ''; host.querySelectorAll('.vc-on').forEach(n => n.classList.remove('vc-on')); host.dataset.sel = ''; info.innerHTML = '<strong>Tap any symbol on the map, or any legend item.</strong> Pinch or use + / − to zoom, drag to move.'; }
    function select(k, o) {
      o = o || {}; const it = BY[k]; if (!it) return;
      clearSel(); host.dataset.sel = k;
      const els = [...svg.querySelectorAll(`[data-f="${k}"]`)];
      svg.classList.add('vc-dim'); els.forEach(n => n.classList.add('vc-hl'));
      let bb = null;
      els.forEach(n => { const b = n.getBBox(); boxes.insertAdjacentHTML('beforeend', `<rect class="vc-box" x="${(b.x - 3).toFixed(1)}" y="${(b.y - 3).toFixed(1)}" width="${(b.width + 6).toFixed(1)}" height="${(b.height + 6).toFixed(1)}" rx="3"/>`); bb = bb ? { x1: Math.min(bb.x1, b.x), y1: Math.min(bb.y1, b.y), x2: Math.max(bb.x2, b.x + b.width), y2: Math.max(bb.y2, b.y + b.height) } : { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height }; });
      host.querySelectorAll(`[data-k="${k}"]`).forEach(n => n.classList.add('vc-on'));
      info.innerHTML = `<div class="vc-info-h"><svg viewBox="0 0 40 24" width="48" height="29" aria-hidden="true">${it.mini()}</svg><strong>${it.name}</strong></div><p>${it.what}</p><p class="vc-do"><b>What you do:</b> ${it.todo}</p>`;
      // keep the matching legend chip / list item visible without jumping the page
      const li = all.querySelector(`.vc-item[data-k="${k}"]`); if (li) all.scrollTop = li.offsetTop - 4;
      const ch = legend.querySelector(`.vc-chip[data-k="${k}"]`); if (ch && !legend.hidden) legend.scrollTop = ch.offsetTop - 30;
      if (o.from !== 'map' && bb) {
        // pan/zoom so every match is visible
        const pad = 18; let w = Math.max(bb.x2 - bb.x1 + pad * 2, (bb.y2 - bb.y1 + pad * 2) * W / H, W / 4); w = Math.min(W, w);
        const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2; animateTo({ x: cx - w / 2, y: cy - w * H / W / 2, w, h: w * H / W });
      }
      if (o.from === 'list' || o.from === 'legend') stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    legend.addEventListener('click', e => { const b = e.target.closest('.vc-chip'); if (b) select(b.dataset.k, { from: 'legend' }); });
    all.addEventListener('click', e => { const b = e.target.closest('.vc-item-btn'); if (b) select(b.dataset.k, { from: 'list' }); });
    host.vcSelect = select; host.vcClear = clearSel;
    apply();
  }

  function scan(root) { (root || document).querySelectorAll('[data-widget="vfrchart"]').forEach(init); }
  const mo = new MutationObserver(() => scan());
  function boot() { scan(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.LessonWidgets = { scan, legendItems: L };
})();
