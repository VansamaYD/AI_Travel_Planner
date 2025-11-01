import React, { useState } from 'react';

export default function ApiTester() {
  const [output, setOutput] = useState<string>('');
  const [tripId, setTripId] = useState('');
  const [expenseJson, setExpenseJson] = useState('{ "amount": 10, "currency": "CNY", "note": "测试" }');
  const [expId, setExpId] = useState('');
  const [expAmount, setExpAmount] = useState('10');
  const [expCurrency, setExpCurrency] = useState('CNY');
  const [expPayerId, setExpPayerId] = useState('');
  const [expItineraryItemId, setExpItineraryItemId] = useState('');
  const [expUserId, setExpUserId] = useState('');
  const [expDescription, setExpDescription] = useState('测试');
  const [expPaymentMethod, setExpPaymentMethod] = useState('card');
  const [expVendor, setExpVendor] = useState('');
  const [expReceiptUrl, setExpReceiptUrl] = useState('');
  const [expRawTranscript, setExpRawTranscript] = useState('');
  const [expSplitJson, setExpSplitJson] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expStatus, setExpStatus] = useState('pending');
  const [newTripJson, setNewTripJson] = useState('{ "title": "我的行程", "start_date": "2025-11-01", "end_date": "2025-11-03" }');
  const [newItemJson, setNewItemJson] = useState('{ "title": "博物馆参观", "date": "2025-11-01" }');
  const [itemId, setItemId] = useState('');
  const [itemTitle, setItemTitle] = useState('博物馆参观');
  const [itemDate, setItemDate] = useState('2025-11-01');
  const [itemStartTime, setItemStartTime] = useState('');
  const [itemEndTime, setItemEndTime] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemType, setItemType] = useState('');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [estCost, setEstCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [itemCurrency, setItemCurrency] = useState('CNY');
  const [itemSequence, setItemSequence] = useState('0');
  const [extraJson, setExtraJson] = useState('');

  async function call(path: string, opts?: any) {
    setOutput('loading...');
    try {
      const fetchOpts = Object.assign({ credentials: 'same-origin' }, opts || {});
      const res = await fetch(path, fetchOpts);
      try {
        const json = await res.json();
        setOutput(JSON.stringify(json, null, 2));
      } catch (e) {
        const text = await res.text();
        setOutput(text);
      }
    } catch (e: any) {
      setOutput('fetch error: ' + String(e?.message || e));
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>API Tester（开发用）</h1>

      <section style={{ marginBottom: 16 }}>
        <h3>列出 Trips</h3>
        <button onClick={() => call('/api/dev/getTrips')}>调用 getTrips</button>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>获取单个 Trip</h3>
        <input placeholder="trip id" value={tripId} onChange={e => setTripId(e.target.value)} style={{ width: 420 }} />
        <div style={{ marginTop: 8 }}>
          <button onClick={() => call('/api/dev/getTrip?id=' + encodeURIComponent(tripId))}>调用 getTrip</button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>添加 Expense（POST）</h3>
        <div>trip id: <input placeholder="trip id" value={tripId} onChange={e => setTripId(e.target.value)} /></div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ marginBottom: 6 }}>id: <input value={expId} onChange={e => setExpId(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>amount: <input value={expAmount} onChange={e => setExpAmount(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>currency: <input value={expCurrency} onChange={e => setExpCurrency(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>payer_id: <input value={expPayerId} onChange={e => setExpPayerId(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>itinerary_item_id: <input value={expItineraryItemId} onChange={e => setExpItineraryItemId(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>user_id: <input value={expUserId} onChange={e => setExpUserId(e.target.value)} style={{ width: 320 }} /></div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>description/note: <input value={expDescription} onChange={e => setExpDescription(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>payment_method: <input value={expPaymentMethod} onChange={e => setExpPaymentMethod(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>vendor: <input value={expVendor} onChange={e => setExpVendor(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>receipt_url: <input value={expReceiptUrl} onChange={e => setExpReceiptUrl(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>raw_transcript: <input value={expRawTranscript} onChange={e => setExpRawTranscript(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>date (YYYY-MM-DD): <input value={expDate} onChange={e => setExpDate(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>category: <input value={expCategory} onChange={e => setExpCategory(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>status: <input value={expStatus} onChange={e => setExpStatus(e.target.value)} style={{ width: 320 }} /></div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 6 }}>split (JSON):</div>
          <textarea rows={3} cols={80} value={expSplitJson} onChange={e => setExpSplitJson(e.target.value)} />
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>Or paste raw JSON here (will be used if non-empty):</div>
          <textarea rows={4} cols={80} value={expenseJson} onChange={e => setExpenseJson(e.target.value)} />
        </div>

        <div style={{ marginTop: 8 }}>
          <button onClick={() => {
            try {
              let body: any = null;
              const raw = (expenseJson || '').trim();
              if (raw) {
                body = JSON.parse(raw);
              } else {
                body = {} as any;
                if (expId) body.id = expId;
                if (expAmount) body.amount = Number(expAmount);
                if (expCurrency) body.currency = expCurrency;
                if (expPayerId) body.payer_id = expPayerId;
                if (expItineraryItemId) body.itinerary_item_id = expItineraryItemId;
                if (expUserId) body.user_id = expUserId;
                if (expDescription) body.description = expDescription;
                if (expPaymentMethod) body.payment_method = expPaymentMethod;
                if (expVendor) body.vendor = expVendor;
                if (expReceiptUrl) body.receipt_url = expReceiptUrl;
                if (expRawTranscript) body.raw_transcript = expRawTranscript;
                if (expDate) body.date = expDate;
                if (expCategory) body.category = expCategory;
                if (expStatus) body.status = expStatus;
                if (expSplitJson) body.split = JSON.parse(expSplitJson);
              }
              call('/api/dev/addExpense', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, expense: body }) });
            } catch (e:any) { setOutput('JSON parse error: ' + e.message); }
          }}>调用 addExpense</button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>创建 Trip（POST）</h3>
        <div>
          <textarea rows={4} cols={80} value={newTripJson} onChange={e => setNewTripJson(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => {
            try {
              const body = JSON.parse(newTripJson);
              call('/api/dev/createTrip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            } catch (e:any) { setOutput('JSON parse error: ' + e.message); }
          }}>调用 createTrip</button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>添加 Itinerary Item（POST）</h3>
        <div>trip id: <input placeholder="trip id" value={tripId} onChange={e => setTripId(e.target.value)} /></div>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ marginBottom: 6 }}>id: <input value={itemId} onChange={e => setItemId(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>title: <input value={itemTitle} onChange={e => setItemTitle(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>date: <input value={itemDate} onChange={e => setItemDate(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>start_time: <input value={itemStartTime} onChange={e => setItemStartTime(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>end_time: <input value={itemEndTime} onChange={e => setItemEndTime(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>type: <input value={itemType} onChange={e => setItemType(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>sequence: <input value={itemSequence} onChange={e => setItemSequence(e.target.value)} style={{ width: 320 }} /></div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>notes: <input value={itemNotes} onChange={e => setItemNotes(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>description: <input value={itemDescription} onChange={e => setItemDescription(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>est_cost: <input value={estCost} onChange={e => setEstCost(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>actual_cost: <input value={actualCost} onChange={e => setActualCost(e.target.value)} style={{ width: 320 }} /></div>
            <div style={{ marginBottom: 6 }}>currency: <input value={itemCurrency} onChange={e => setItemCurrency(e.target.value)} style={{ width: 320 }} /></div>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ marginBottom: 6 }}>location.lat: <input value={locLat} onChange={e => setLocLat(e.target.value)} style={{ width: 200 }} /></div>
            <div style={{ marginBottom: 6 }}>location.lng: <input value={locLng} onChange={e => setLocLng(e.target.value)} style={{ width: 200 }} /></div>
            <div style={{ marginBottom: 6 }}>location.address: <input value={locAddress} onChange={e => setLocAddress(e.target.value)} style={{ width: 320 }} /></div>
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>extra (JSON):</div>
            <textarea rows={4} cols={40} value={extraJson} onChange={e => setExtraJson(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>Or paste raw JSON here (will be used if non-empty):</div>
          <textarea rows={6} cols={100} value={newItemJson} onChange={e => setNewItemJson(e.target.value)} />
        </div>

        <div style={{ marginTop: 8 }}>
          <button onClick={() => {
            try {
              let body: any = null;
              const raw = (newItemJson || '').trim();
              if (raw) {
                // prefer explicit JSON if provided
                body = JSON.parse(raw);
              } else {
                body = {} as any;
                if (itemId) body.id = itemId;
                if (itemTitle) body.title = itemTitle;
                if (itemDate) body.date = itemDate;
                if (itemStartTime) body.start_time = itemStartTime;
                if (itemEndTime) body.end_time = itemEndTime;
                if (itemNotes) body.notes = itemNotes;
                if (itemDescription) body.description = itemDescription;
                if (itemType) body.type = itemType;
                if (locLat || locLng || locAddress) {
                  body.location = {} as any;
                  if (locLat) body.location.lat = Number(locLat);
                  if (locLng) body.location.lng = Number(locLng);
                  if (locAddress) body.location.address = locAddress;
                }
                if (estCost) body.est_cost = Number(estCost);
                if (actualCost) body.actual_cost = Number(actualCost);
                if (itemCurrency) body.currency = itemCurrency;
                if (itemSequence) body.sequence = Number(itemSequence);
                if (extraJson) body.extra = JSON.parse(extraJson);
              }
              call('/api/dev/addItineraryItem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, item: body }) });
            } catch (e:any) { setOutput('JSON parse error: ' + e.message); }
          }}>调用 addItineraryItem</button>
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h3>查看重算 SQL（只读）</h3>
        <button onClick={() => call('/api/dev/getRecalcSql')}>获取 recalculate_budgets.sql 内容</button>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>响应 / 输出</h3>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, border: '1px solid #eee' }}>{output}</pre>
      </section>
    </div>
  );
}
