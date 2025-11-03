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
    // 优先从 localStorage 读取，支持多个可能的键名
    let k = localStorage.getItem('amap_key') || localStorage.getItem('AMAP_KEY') || localStorage.getItem('amapKey') || '';
    if (!k && process.env.NEXT_PUBLIC_AMAP_KEY) k = process.env.NEXT_PUBLIC_AMAP_KEY;
    const s = localStorage.getItem('amap_js_code') || localStorage.getItem('AMAP_JS_CODE') || localStorage.getItem('amapSecurityJsCode') || '';
    if (k) {
      setAmapKey(k);
      setTempKey(k); // 同步到临时输入
    }
    if (s) {
      setSecCode(s);
      setTempSecCode(s); // 同步到临时输入
    }
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

  // 判断坐标是否在中国范围内（大致范围：经度 73-135，纬度 18-54）
  const isInChina = React.useCallback((lng: number, lat: number): boolean => {
    return lng >= 73 && lng <= 135 && lat >= 18 && lat <= 54;
  }, []);

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
      if (had) {
        try {
          // 首先总是调用 setFitView（保持原有行为）
          map.setFitView();
          
          // 然后检查是否有标记在国外，如果有则限制缩放级别
          let hasOutsideChina = false;
          for (const m of markers) {
            try {
              const pos = m.getPosition();
              if (pos && Array.isArray(pos) && pos.length >= 2) {
                if (!isInChina(pos[0], pos[1])) {
                  hasOutsideChina = true;
                  break; // 找到一个国外的就退出
                }
              }
            } catch {}
          }
          
          // 如果有标记在国外，限制最大缩放级别为 12，避免高德地图显示问题
          if (hasOutsideChina) {
            setTimeout(() => {
              try {
                const currentZoom = mapRef.current?.getZoom && mapRef.current.getZoom();
                if (typeof currentZoom === 'number' && currentZoom > 12) {
                  mapRef.current?.setZoom(12);
                }
              } catch {}
            }, 100); // 延迟执行，确保 setFitView 完成
          }
        } catch (e) {
          // 如果判断失败，至少确保调用了 setFitView
          try { 
            map.setFitView(); 
          } catch {}
        }
      }
      // 初始渲染后，应用当前样式（选中/悬停）
      try { updateMarkerStyles(); } catch {}
    });

    return () => { try { map?.destroy(); } catch {} };
  }, [ready, items, isInChina]);

  // 聚焦到选中项并高亮标记（根据国内外位置调整合适的缩放级别）
  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (!selectedId) return;
    const m = markersRef.current.get(String(selectedId));
    if (m) {
      try {
        const pos = m.getPosition();
        if (!pos) return;
        
        // 高德地图的 getPosition() 返回 LngLat 对象，可以直接使用
        // 为了兼容，也支持数组格式
        let lng: number, lat: number;
        if (Array.isArray(pos)) {
          if (pos.length < 2) return;
          lng = pos[0];
          lat = pos[1];
        } else if (pos.lng !== undefined && pos.lat !== undefined) {
          // LngLat 对象格式
          lng = pos.lng;
          lat = pos.lat;
        } else {
          return;
        }
        
        // 检查是否在中国范围内
        const inChina = isInChina(lat, lng);
        const currentZoom = mapRef.current.getZoom && mapRef.current.getZoom();
        
        // 构建坐标数组 [lng, lat] 或使用 LngLat 对象
        const centerPos = Array.isArray(pos) ? pos : [lng, lat];
        
        if (inChina) {
          // 在中国：可以放大到级别 14（如果当前已经 >= 14，只居中）
          if (typeof currentZoom === 'number' && currentZoom >= 14) {
            mapRef.current.setCenter(centerPos);
          } else {
            mapRef.current.setZoomAndCenter(14, centerPos);
          }
        } else {
          // 不在中国：使用合适的缩放级别（12），确保能够聚焦但不会太大
          // 如果当前缩放已经 >= 12，保持当前缩放或使用12，否则放大到12
          const targetZoom = typeof currentZoom === 'number' && currentZoom >=9 ? currentZoom : 9;
          mapRef.current.setZoomAndCenter(targetZoom, centerPos);
        }
      } catch (e) {
        console.error('聚焦选中项时出错:', e);
      }
      try { m.setzIndex(9999); } catch {}
      try { m.setAnimation('AMAP_ANIMATION_DROP'); } catch {}
      // 简单高亮：改变图标颜色（使用内置样式有限，这里不自定义图标，主要通过 zIndex + animation）
      setTimeout(() => { try { m.setAnimation(null); } catch {} }, 1200);
    }
    try { updateMarkerStyles(); } catch {}
  }, [selectedId, ready, updateMarkerStyles, isInChina]);

  // 悬停仅改变样式，不移动与缩放
  React.useEffect(() => {
    if (!ready) return;
    try { updateMarkerStyles(); } catch {}
  }, [hoveredId, ready, updateMarkerStyles]);

  // 用于配置面板的临时输入状态
  const [tempKey, setTempKey] = React.useState('');
  const [tempSecCode, setTempSecCode] = React.useState('');

  const handleSave = () => {
    if (!tempKey?.trim()) {
      alert('请输入 AMap Key');
      return;
    }
    // 保存到 localStorage（多个键名确保兼容性）
    localStorage.setItem('amap_key', tempKey.trim());
    localStorage.setItem('AMAP_KEY', tempKey.trim());
    localStorage.setItem('amapKey', tempKey.trim());
    if (tempSecCode?.trim()) {
      localStorage.setItem('amap_js_code', tempSecCode.trim());
      localStorage.setItem('AMAP_JS_CODE', tempSecCode.trim());
      localStorage.setItem('amapSecurityJsCode', tempSecCode.trim());
    }
    // 立即更新 state，触发地图加载
    setAmapKey(tempKey.trim());
    if (tempSecCode?.trim()) setSecCode(tempSecCode.trim());
  };

  if (!amapKey) {
    return (
      <div style={{ border: '1px dashed #ddd', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 13, color: '#6b7280' }}>未配置高德地图 Key，请输入并保存：</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input placeholder="AMap Key" value={tempKey} onChange={(e) => setTempKey(e.target.value)} style={{ width: 280 }} />
          <input placeholder="Security JS Code（可选）" value={tempSecCode} onChange={(e) => setTempSecCode(e.target.value)} style={{ width: 240 }} />
          <button onClick={handleSave}>保存</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>保存后会自动加载地图，刷新页面也会保留配置</div>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
      <div ref={ref} style={{ width: '100%', height: '60vh' }} />
    </div>
  );
}


