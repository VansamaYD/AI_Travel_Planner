import React, { useState } from 'react';

export default function ApiTester() {
  const [output, setOutput] = useState<string>('');
  const [tripId, setTripId] = useState('');
  const [expenseJson, setExpenseJson] = useState('{ "amount": 10, "currency": "CNY", "note": "测试" }');

  async function call(path: string, opts?: any) {
    setOutput('loading...');
    try {
      const res = await fetch(path, opts);
      const text = await res.text();
      setOutput(text);
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
        <div style={{ marginTop: 8 }}>
          <textarea rows={6} cols={80} value={expenseJson} onChange={e => setExpenseJson(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => {
            try {
              const body = JSON.parse(expenseJson);
              call('/api/dev/addExpense', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, expense: body }) });
            } catch (e:any) {
              setOutput('JSON parse error: ' + e.message);
            }
          }}>调用 addExpense</button>
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
