"use client";
import React from 'react';

type Props = {
  items: Array<{ id?: string; title?: string; location?: any; date?: string }>; // expects location { lat?: number; lng?: number; address?: string }
  selectedId?: string | null;
  hoveredId?: string | null;
};

declare global { interface Window { AMap?: any; } }

export default function MapView({ items, selectedId, hoveredId }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [amapKey, setAmapKey] = React.useState<string | null>(null);
  const [secCode, setSecCode] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const mapRef = React.useRef<any>(null);
  const markersRef = React.useRef<Map<string, any>>(new Map());
  const markerColors = React.useRef<{ base: string; hover: string; selected: string }>({ base: '#2563eb', hover: '#f59e0b', selected: '#ef4444' });

  const buildMarkerContent = (color: string) => {
    const c = color;
    return `<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 0 2px ${c}33"></div>`;
  };

  const updateMarkerStyles = React.useCallback(() => {
    markersRef.current.forEach((m, id) => {
      let color = markerColors.current.base;
      if (selectedId && id === String(selectedId)) color = markerColors.current.selected;
      else if (hoveredId && id === String(hoveredId)) color = markerColors.current.hover;
      try { m.setContent(buildMarkerContent(color)); } catch {}
      try { m.setzIndex(selectedId && id === String(selectedId) ? 9999 : 100); } catch {}
    });
  }, [selectedId, hoveredId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = localStorage.getItem('amap_key') || localStorage.getItem('AMAP_KEY') || localStorage.getItem('amapKey') || process.env.NEXT_PUBLIC_AMAP_KEY || '';
    const s = localStorage.getItem('amap_js_code') || localStorage.getItem('AMAP_JS_CODE') || localStorage.getItem('amapSecurityJsCode') || '';
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
    mapRef.current = map;
    const geocoder = new AMap.Geocoder();
    const infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -12) });
    const toLngLat = (it: any): [number, number] | null => {
      const loc = it?.location || {};
      if (typeof loc === 'object' && typeof loc.lng === 'number' && typeof loc.lat === 'number') return [loc.lng, loc.lat];
      return null;
    };

    const markers: any[] = [];
    markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
    markersRef.current.clear();
    const bounds = new AMap.Bounds();
    let had = false;
    const tasks: Promise<void>[] = [];

    (items || []).forEach((it) => {
      const ll = toLngLat(it);
      if (ll) {
        const m = new AMap.Marker({ position: ll, title: it.title || '', content: buildMarkerContent(markerColors.current.base), offset: new AMap.Pixel(-9, -9) });
        markers.push(m);
        // info window on hover
        try {
          m.on('mouseover', () => {
            const name = it.title || '';
            const date = it.date || '';
            const addr = it?.location?.address || '';
            infoWindow.setContent(`<div style="font-size:12px;line-height:1.4"><div><strong>${name}</strong></div>${date ? `<div>${date}</div>` : ''}${addr ? `<div style='color:#6b7280'>${addr}</div>` : ''}</div>`);
            infoWindow.open(map, m.getPosition());
          });
          m.on('mouseout', () => { try { infoWindow.close(); } catch {} });
        } catch {}
        bounds.extend(ll as any);
        had = true;
        if (it?.id) markersRef.current.set(String(it.id), m);
      } else if (it?.location?.address) {
        tasks.push(new Promise((resolve) => {
          geocoder.getLocation(it.location.address, (status: string, result: any) => {
            try {
              if (status === 'complete' && result?.geocodes?.length) {
                const g = result.geocodes[0];
                const ll2: [number, number] = [g.location.lng, g.location.lat];
                const m2 = new AMap.Marker({ position: ll2, title: it.title || '', content: buildMarkerContent(markerColors.current.base), offset: new AMap.Pixel(-9, -9) });
                markers.push(m2);
                try {
                  m2.on('mouseover', () => {
                    const name = it.title || '';
                    const date = it.date || '';
                    const addr = it?.location?.address || '';
                    infoWindow.setContent(`<div style="font-size:12px;line-height:1.4"><div><strong>${name}</strong></div>${date ? `<div>${date}</div>` : ''}${addr ? `<div style='color:#6b7280'>${addr}</div>` : ''}</div>`);
                    infoWindow.open(map, m2.getPosition());
                  });
                  m2.on('mouseout', () => { try { infoWindow.close(); } catch {} });
                } catch {}
                bounds.extend(ll2 as any);
                had = true;
                if (it?.id) markersRef.current.set(String(it.id), m2);
              }
            } finally { resolve(); }
          });
        }));
      }
    });

    Promise.all(tasks).then(() => {
      if (markers.length) map.add(markers);
      try { if (had) map.setFitView(); } catch {}
      // 初始渲染后，应用当前样式（选中/悬停）
      try { updateMarkerStyles(); } catch {}
    });

    return () => { try { map?.destroy(); } catch {} };
  }, [ready, items]);

  // 聚焦到选中项并高亮标记（尽量减少跳动：若缩放已足够则只居中不改变zoom）
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!selectedId) return;
    const m = markersRef.current.get(String(selectedId));
    if (m) {
      try {
        const currentZoom = mapRef.current.getZoom && mapRef.current.getZoom();
        const pos = m.getPosition();
        if (typeof currentZoom === 'number' && currentZoom >= 14) {
          mapRef.current.setCenter(pos);
        } else {
          mapRef.current.setZoomAndCenter(14, pos);
        }
      } catch {}
      try { m.setzIndex(9999); } catch {}
      try { m.setAnimation('AMAP_ANIMATION_DROP'); } catch {}
      // 简单高亮：改变图标颜色（使用内置样式有限，这里不自定义图标，主要通过 zIndex + animation）
      setTimeout(() => { try { m.setAnimation(null); } catch {} }, 1200);
    }
    try { updateMarkerStyles(); } catch {}
  }, [selectedId, ready, updateMarkerStyles]);

  // 悬停仅改变样式，不移动与缩放
  React.useEffect(() => {
    if (!ready) return;
    try { updateMarkerStyles(); } catch {}
  }, [hoveredId, ready, updateMarkerStyles]);

  if (!amapKey) {
    return (
      <div style={{ border: '1px dashed #ddd', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>未配置高德地图 Key，请输入并保存：</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input placeholder="AMap Key" value={amapKey || ''} onChange={(e) => setAmapKey(e.target.value)} style={{ width: 280 }} />
          <input placeholder="Security JS Code（可选）" value={secCode || ''} onChange={(e) => setSecCode(e.target.value)} style={{ width: 240 }} />
          <button onClick={() => { if (amapKey) { localStorage.setItem('amap_key', amapKey); localStorage.setItem('AMAP_KEY', amapKey); localStorage.setItem('amapKey', amapKey); } if (secCode) { localStorage.setItem('amap_js_code', secCode); localStorage.setItem('AMAP_JS_CODE', secCode); localStorage.setItem('amapSecurityJsCode', secCode); } }}>保存</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div ref={ref} style={{ width: '100%', height: '60vh' }} />
    </div>
  );
}


