"use client";
import React from 'react';

type Props = {
  items: Array<{ title?: string; location?: any; }>; // expects location { lat?: number; lng?: number; address?: string }
};

declare global { interface Window { AMap?: any; } }

export default function MapView({ items }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [amapKey, setAmapKey] = React.useState<string | null>(null);
  const [secCode, setSecCode] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = localStorage.getItem('amap_key') || process.env.NEXT_PUBLIC_AMAP_KEY || '';
    const s = localStorage.getItem('amap_js_code') || '';
    setAmapKey(k || null);
    setSecCode(s || null);
  }, []);

  React.useEffect(() => {
    if (!amapKey) return;
    if (window.AMap) { setReady(true); return; }
    // optional security code per AMap new policy
    if (secCode && (window as any)._AMAPSecurityConfig === undefined) {
      (window as any)._AMAPSecurityConfig = { securityJsCode: secCode };
    }
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapKey)}&plugin=AMap.Geocoder`;
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch {} };
  }, [amapKey, secCode]);

  React.useEffect(() => {
    if (!ready || !ref.current || !window.AMap) return;
    const AMap = window.AMap;
    const map = new AMap.Map(ref.current, { zoom: 12, center: [116.397428, 39.90923] });
    const geocoder = new AMap.Geocoder();
    const toLngLat = (it: any): [number, number] | null => {
      const loc = it?.location || {};
      if (typeof loc === 'object' && typeof loc.lng === 'number' && typeof loc.lat === 'number') return [loc.lng, loc.lat];
      return null;
    };

    const markers: any[] = [];
    const bounds = new AMap.Bounds();
    let had = false;
    const tasks: Promise<void>[] = [];

    (items || []).forEach((it) => {
      const ll = toLngLat(it);
      if (ll) {
        const m = new AMap.Marker({ position: ll, title: it.title || '' });
        markers.push(m);
        bounds.extend(ll as any);
        had = true;
      } else if (it?.location?.address) {
        tasks.push(new Promise((resolve) => {
          geocoder.getLocation(it.location.address, (status: string, result: any) => {
            try {
              if (status === 'complete' && result?.geocodes?.length) {
                const g = result.geocodes[0];
                const ll2: [number, number] = [g.location.lng, g.location.lat];
                const m2 = new AMap.Marker({ position: ll2, title: it.title || '' });
                markers.push(m2);
                bounds.extend(ll2 as any);
                had = true;
              }
            } finally { resolve(); }
          });
        }));
      }
    });

    Promise.all(tasks).then(() => {
      if (markers.length) map.add(markers);
      try { if (had) map.setFitView(); } catch {}
    });

    return () => { try { map?.destroy(); } catch {} };
  }, [ready, items]);

  if (!amapKey) {
    return (
      <div style={{ border: '1px dashed #ddd', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>未配置高德地图 Key，请输入并保存：</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input placeholder="AMap Key" onChange={(e) => setAmapKey(e.target.value)} style={{ width: 280 }} />
          <input placeholder="Security JS Code（可选）" onChange={(e) => setSecCode(e.target.value)} style={{ width: 240 }} />
          <button onClick={() => { if (amapKey) localStorage.setItem('amap_key', amapKey); if (secCode) localStorage.setItem('amap_js_code', secCode); }}>保存</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={ref} style={{ width: '100%', height: 320 }} />
    </div>
  );
}


