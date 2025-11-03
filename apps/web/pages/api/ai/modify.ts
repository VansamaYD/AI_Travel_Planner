import type { NextApiRequest, NextApiResponse } from 'next';

// New endpoint: /api/ai/modify
// Purpose: Specialized proxy for "modify existing trip" flows.
// - Expects POST body: { user_input: string, current_trip: object, apiKey?, apiUrl?, applyUpdates?: boolean, owner_id?: string }
// - Builds a system prompt that instructs the model to return a strict JSON with these keys:
//   { new_items, update_items, new_expenses, update_expenses, trip_updates }
// - Returns { ok:true, parsed, rawModelText, debugRequest, intendedCalls, updatesApplied? }
// - If applyUpdates===true AND owner_id provided, it will attempt to call local dev endpoints to apply the changes.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let debugRequest: any = null;
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { user_input, current_trip, apiKey: bodyApiKey, apiUrl: bodyApiUrl, applyUpdates, owner_id, model } = req.body || {};
    if (!user_input || typeof user_input !== 'string') return res.status(400).json({ error: 'missing_user_input' });
    if (!current_trip) return res.status(400).json({ error: 'missing_current_trip' });

    // Resolve API key / url (same precedence as chat.ts)
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.TONGYI_API_KEY || bodyApiKey;
    const apiUrl = process.env.DASHSCOPE_BASE_URL || process.env.TONGYI_API_URL || bodyApiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    if (!apiUrl) return res.status(400).json({ error: 'no_api_configured', message: '请提供 API Key 或在服务端配置 DASHSCOPE_BASE_URL / DASHSCOPE_API_KEY' });

    // Build system prompt specialized for modify flows.
    const systemText = `你是一个旅行规划助手。现在的任务是：在已有的 "当前行程" (Current Trip JSON) 基础上，根据用户的最新需求（user_input）对行程、条目 (itinerary items) 与费用 (expenses) 进行更新或补充。

【关键要求】输出格式强制约束：
- 你的输出必须是一个可以直接被 JSON.parse() 解析的、完整的 JSON 对象字符串，不得包含任何前置或后置的文字说明、Markdown 标记、代码块标记（如 \`\`\`json）、注释、或其他非 JSON 内容。
- 如果无法满足上述 JSON 格式要求（例如用户需求过于模糊或与行程无关），必须返回 null（即字符串 "null"）。
- 禁止输出包含解释文字的混合内容。输出要么是完全有效的 JSON，要么是字符串 "null"。

严格要求：
- 只输出一个有效且严格的 JSON 对象（不要输出解释文字、Markdown 或额外注释）。
- 顶层对象应包含以下字段（允许某些字段为空数组或省略）：
  - "new_items": 新建的 itinerary items 数组（可选）
  - "update_items": 需要更新的 itinerary items 数组（可选）
  - "new_expenses": 新建的 expense 数组（可选）
  - "update_expenses": 需要更新的 expense 数组（可选）
  - "trip_updates": 对 Trip 本身的更新对象（可选）

为了提高模型返回的丰富度和可执行性，请遵循以下风格与建议：
- 对每个新建项尽量提供完整信息（title, date, start_time/end_time, description, location.address 或 lat/lng, est_cost, currency, sequence/day_index）以便直接用于持久化。
- 如需引用刚创建的新项（例如给新项添加费用），请在 new_items 中为该项返回一个临时字段 "local_id"（任意字符串，以 "local_" 前缀为佳），并在 new_expenses 中把 "itinerary_item_id" 设置为该 "local_id"，客户端在创建后应把临时 id 替换为真实 id。
- 对 update_items 与 update_expenses，务必包含数据库记录的真实 "id" 字段，并只在 "updates" 中包含需要更改的字段或返回整个记录以供审核。
- 对于费用分配，如果模型识别到某个未绑定的 expense 可归到某一项，请优先将其绑定到最合适的 itinerary item（优先级：同日且时间范围覆盖 > 同地理位置 > 相近描述关键词）。
- 当涉及调整天数/日期时，建议同时返回明确的 trip_updates（例如更新 start_date/end_date, estimated_budget 与 currency），并在 new_items 中把新增日期对应的 items 标注好 date/day_index。

字段格式说明（请严格遵守字段名与类型）：

itinerary item (新建项 new_items 中的元素)：
{
  "local_id": string | undefined,   // 可选：客户端用来在创建后把新建项关联到 new_expenses
  "id": string | undefined,         // 若是 update_items 中的已有项则必须提供
  "trip_id": string | undefined,    // 可选，服务器/客户端会补充
  "day_index": number | undefined,
  "title": string,                  // 必填
  "date": "YYYY-MM-DD",          // 必填
  "start_time": "HH:MM" | null | undefined,
  "end_time": "HH:MM" | null | undefined,
  "notes": string | null | undefined,
  "description": string | null | undefined,
  "type": string | null | undefined,
  "location": { "lat": number | undefined, "lng": number | undefined, "address": string | undefined } | null | undefined,
  "est_cost": number | null | undefined,
  "actual_cost": number | null | undefined,
  "currency": string | null | undefined,
  "sequence": number | undefined,
  "extra": any | undefined
}

itinerary item (更新项 update_items 中的元素)：
{
  "id": string,                     // 必须：用于定位数据库记录
  // 其余字段按需返回用于更新或审阅
}
针对涉及到消费的问题，如果需要记录消费信息，使用expense就行记录：
expense 对象（新建 new_expenses / 更新 update_expenses）结构如下：
{
  "id": string | undefined,
  "trip_id": string | undefined,
  "itinerary_item_id": string | null | undefined, // 可为真实 id 或 new_items 中的 local_id
  "amount": number,               // 必填
  "currency": string,             // 必填，如 "CNY"
  "payer_id": string | undefined,
  "user_id": string | undefined,
  "note": string | null | undefined, // 用于自由文本备注，替代 description
  "category": string | null | undefined,
  "date": "YYYY-MM-DD" | undefined,
  "vendor": string | null | undefined,
  "payment_method": string | null | undefined,
  "recorded_via": string | undefined,
  "raw_transcript": string | null | undefined,
  "receipt_url": string | null | undefined,
  "split": any | undefined,
  "status": string | undefined
}


trip_updates 的格式：
{
  "id": "string",
  "updates": {
    "id": "string" | undefined,
    "owner_id": "string" | null | undefined,
    "title": "string",
    "description": "string" | null | undefined,
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "estimated_budget": "number" | null | undefined,
    "currency": "string" | undefined,
    "status": "string" | undefined,
    "visibility": "string" | undefined,
    "collaborators": ["string"] | undefined,
    "metadata": "any" | undefined,
    "created_at": "string" | undefined,
    "updated_at": "string" | undefined
  }
}

请返回一个对象，至少包含要更新的字段，例如：
{"id": "trip-id", "updates": { "title": "北京观光游","start_date": "2025-12-01", "end_date": "2025-12-05", "estimated_budget": 7000, "currency": "CNY" }}

示例 1（延长行程并添加项与费用，示例展示 local_id 使用）：
{
  "new_items": [
    { "local_id": "local_1", "title": "休闲一天，城市漫步", "date": "2025-12-05", "start_time": "09:00", "end_time": "12:00", "description": "自由漫步行程", "location": { "address": "市中心步行街" }, "est_cost": 0, "currency": "CNY" }
  ],
  "new_expenses": [
    { "amount": 120, "currency": "CNY", "itinerary_item_id": "local_1", "description": "市区小吃预算" }
  ],
  "trip_updates": { "id": "11111111-1111-1111-1111-111111111111", "updates": { "end_date": "2025-12-05", "estimated_budget": 2000 } }
}

示例 2（修改已有项与拆分费用）：
{
  "update_items": [ { "id": "add67495-ef9b-41c0-b3cd-a44aa6877913", "title": "大阪城：上午参观（更新）", "start_time": "09:00", "end_time": "12:00" } ],
  "update_expenses": [ { "id": "7bc2e6d4-37b9-4b61-959e-ea26ad2a81d2", "amount": 800 }, { "id": "some-other-exp-id", "amount": 200 } ],
  "new_expenses": [ { "amount": 100, "currency": "CNY", "description": "额外交通", "date": "2025-01-03" } ]
}

输出注意：仅输出 JSON。尽量丰富每个建议的字段，优先提供可直接用于持久化的完整条目（包括 location 和估计费用等）。当无法确定某些字段时可使用 null 或省略字段，但不要返回过于简单的占位型建议（例如只有 title 的 new_items）。
`;

    // Construct user message: user_input first, then current_trip JSON
    const userMsgText = `用户需求:\n${user_input}\n\n当前行程(JSON):\n${JSON.stringify(current_trip)}`;

    // Build request body for upstream
    const base = String(apiUrl || process.env.TONGYI_API_URL || '');
    let target = base;
    if (!/\/chat\/.+/.test(base)) target = base.replace(/\/$/, '') + '/chat/completions';

    const systemMsg = { role: 'system', content: [{ type: 'text', text: systemText }] };
    const userMsg = { role: 'user', content: [{ type: 'text', text: userMsgText }] };
    const bodyObj: any = {
      model: model || 'qwen3-vl-32b-thinking',
      messages: [systemMsg, userMsg],
      stream: false,
    };

    debugRequest = { target, body: bodyObj };

    const upstreamResp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyObj),
    }).catch((e) => ({ ok: false, error: String(e) } as any));

    if (!upstreamResp) return res.status(502).json({ error: 'upstream_error', message: '无法连接上游模型', debugRequest });
    if ((upstreamResp as any).ok === false && (upstreamResp as any).error) return res.status(502).json({ error: 'upstream_error', detail: (upstreamResp as any).error, debugRequest });

    const contentType = upstreamResp.headers?.get?.('content-type') || '';
    let bodyText = '';
    if (contentType.includes('application/json')) {
      const data = await upstreamResp.json();

      const extractModelTextFromPayload = (payload: any): string => {
        if (!payload) return '';
        if (typeof payload === 'string') return payload;
        if (typeof payload.output?.text === 'string') return payload.output.text;
        if (typeof payload.data?.text === 'string') return payload.data.text;
        if (typeof payload.result === 'string') return payload.result;
        if (typeof payload.text === 'string') return payload.text;
        if (Array.isArray(payload.choices) && payload.choices.length) {
          const c = payload.choices[0];
          if (typeof c.text === 'string') return c.text;
          if (c.message) {
            if (typeof c.message === 'string') return c.message;
            if (typeof c.message.content === 'string') return c.message.content;
            if (Array.isArray(c.message.content)) return c.message.content.map((p: any) => (p?.text ?? '')).join('\n');
            if (Array.isArray(c.message?.content) && c.message.content.length && typeof c.message.content[0].text === 'string') return c.message.content[0].text;
          }
          if (typeof c.message?.reasoning_content === 'string') return c.message.reasoning_content;
        }
        if (Array.isArray(payload.results) && payload.results.length) {
          const r = payload.results[0];
          if (typeof r?.content === 'string') return r.content;
          if (Array.isArray(r?.content)) return r.content.map((p: any) => p.text ?? '').join('\n');
        }
        return JSON.stringify(payload);
      };
      bodyText = extractModelTextFromPayload(data || {});
    } else {
      bodyText = await upstreamResp.text();
    }

    // Try parse JSON with enhanced extraction
    let parsed: any = null;
    // 1. Try direct parse
    try { parsed = JSON.parse(bodyText.trim()); } catch (e) {}
    // 2. Try extract from markdown code blocks
    if (!parsed) {
      const codeBlockMatch = bodyText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try { parsed = JSON.parse(codeBlockMatch[1].trim()); } catch (e) {}
      }
    }
    // 3. Try extract first JSON object
    if (!parsed) {
      const jsonMatch = bodyText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {}
      }
    }
    // 4. Check if response is null string
    if (!parsed && bodyText.trim() === 'null') {
      parsed = null;
    }

    if (!parsed && bodyText.trim() !== 'null') {
      return res.status(502).json({ error: 'model_returned_non_json', text: bodyText.slice(0, 200), message: '模型未返回可解析 JSON（modify），请重试或重新表述需求。', debugRequest });
    }

    // Normalize to expected shape: ensure keys exist as arrays/objects
    // If parsed is null, return empty structure
    const normalized: any = parsed === null ? {
      new_items: [],
      update_items: [],
      new_expenses: [],
      update_expenses: [],
      trip_updates: null,
    } : {
      new_items: Array.isArray(parsed.new_items) ? parsed.new_items : [],
      update_items: Array.isArray(parsed.update_items) ? parsed.update_items : [],
      new_expenses: Array.isArray(parsed.new_expenses) ? parsed.new_expenses : [],
      update_expenses: Array.isArray(parsed.update_expenses) ? parsed.update_expenses : [],
      trip_updates: parsed.trip_updates || parsed.trip_updates === null ? parsed.trip_updates : parsed.trip_updates || null,
    };

    // helper: sanitize expense objects to DB columns and map legacy `description` -> `note`
    const sanitizeExpense = (raw: any) => {
      if (!raw || typeof raw !== 'object') return {};
      // map description -> note
      if (raw.description && !raw.note) raw.note = raw.description;
      const allowedExpenseKeys = ['id','trip_id','itinerary_item_id','user_id','amount','currency','category','date','note','recorded_via','raw_transcript','created_at','payer_id','status','payment_method','vendor','receipt_url','split'];
      const out: any = {};
      for (const k of Object.keys(raw)) {
        if (allowedExpenseKeys.includes(k)) {
          out[k] = raw[k];
        }
      }
      return out;
    };

    // Build intendedCalls for client or server execution
    const intendedCalls: any[] = [];

    // Helper to push call descriptors
    const pushCall = (endpoint: string, method: string, body: any) => intendedCalls.push({ endpoint, method, body });

    // For new items -> POST /api/dev/addItineraryItem
    for (const it of normalized.new_items) {
      // create item payload and ensure trip id exists
      const itemPayload = { ...it };
      if ((!itemPayload.trip_id || itemPayload.trip_id === '') && current_trip && current_trip.id) {
        itemPayload.trip_id = current_trip.id;
      }
      // dev endpoint expects { tripId, item }
      const body = { tripId: itemPayload.trip_id || (current_trip && current_trip.id) || null, item: itemPayload };
      pushCall('/api/dev/addItineraryItem', 'POST', body);
    }

    // For update items -> POST /api/dev/updateItem
    for (const it of normalized.update_items) {
      const body = { id: it.id, updates: { ...it } };
      // remove id from updates (PostgREST expects id path or payload format used by dev endpoint)
      delete body.updates.id;
      pushCall('/api/dev/updateItem', 'POST', body);
    }

    // For new expenses -> POST /api/dev/addExpense
    for (const ex of normalized.new_expenses) {
      const expensePayload = { ...ex };
      if ((!expensePayload.trip_id || expensePayload.trip_id === '') && current_trip && current_trip.id) {
        expensePayload.trip_id = current_trip.id;
      }
      // sanitize and map fields to DB columns
      const sanitized = sanitizeExpense(expensePayload);
      // dev endpoint expects { tripId, expense }
      const body = { tripId: sanitized.trip_id || (current_trip && current_trip.id) || null, expense: sanitized };
      pushCall('/api/dev/addExpense', 'POST', body);
    }

    // For update expenses -> POST /api/dev/updateExpense
    for (const ex of normalized.update_expenses) {
      // map description->note and only include allowed keys in updates
      const updatesRaw = { ...ex };
      delete updatesRaw.id;
      if (updatesRaw.description && !updatesRaw.note) updatesRaw.note = updatesRaw.description;
      const allowedUpdateKeys = ['trip_id','itinerary_item_id','user_id','amount','currency','category','date','note','recorded_via','raw_transcript','payer_id','status','payment_method','vendor','receipt_url','split'];
      const updates: any = {};
      for (const k of Object.keys(updatesRaw)) {
        if (allowedUpdateKeys.includes(k)) updates[k] = updatesRaw[k];
      }
      const body = { id: ex.id, updates };
      pushCall('/api/dev/updateExpense', 'POST', body);
    }

    // For trip updates -> POST /api/dev/updateTrip
    if (normalized.trip_updates) {
      // If trip_updates is already { id, updates }, use as-is; otherwise wrap
      if (normalized.trip_updates.id && normalized.trip_updates.updates) {
        pushCall('/api/dev/updateTrip', 'POST', normalized.trip_updates);
      } else if (typeof normalized.trip_updates === 'object') {
        pushCall('/api/dev/updateTrip', 'POST', { id: normalized.trip_updates.id || null, updates: normalized.trip_updates });
      }
    }

    const result: any = { ok: true, parsed: normalized, rawModelText: bodyText, debugRequest, intendedCalls };

    // Optionally apply updates server-side if requested and owner_id provided
    if (applyUpdates && owner_id) {
      // Determine base URL to call internal dev endpoints. Prefer env override, else localhost:3001
      const baseDevUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3001';
      const applyResults: any[] = [];

      // Map for local_id -> created real id
      const localIdMap: Record<string, string> = {};
      for (const call of intendedCalls) {
        // payload is wrapper already (e.g., { tripId, item } or { tripId, expense })
        const payload: any = JSON.parse(JSON.stringify(call.body));

        // Normalize wrapper keys and inject owner_id / tripId when missing
        if (call.endpoint === '/api/dev/addItineraryItem') {
          // ensure tripId
          if ((!payload.tripId || payload.tripId === '') && current_trip && current_trip.id) payload.tripId = current_trip.id;
          // attach owner_id into nested item if provided
          payload.item = payload.item || {};
          if (owner_id && !payload.item.owner_id) payload.item.owner_id = owner_id;
          // If item references a local_id in some nested field, keep it — we'll map after creation
        }

        if (call.endpoint === '/api/dev/addExpense') {
          if ((!payload.tripId || payload.tripId === '') && current_trip && current_trip.id) payload.tripId = current_trip.id;
          payload.expense = payload.expense || {};
          if (owner_id && !payload.expense.owner_id) payload.expense.owner_id = owner_id;
          // If itinerary_item_id refers to a local_id, replace if we've already resolved it
          if (payload.expense.itinerary_item_id && localIdMap[payload.expense.itinerary_item_id]) {
            payload.expense.itinerary_item_id = localIdMap[payload.expense.itinerary_item_id];
          }
        }

        try {
          const r = await fetch(baseDevUrl.replace(/\/$/, '') + call.endpoint, {
            method: call.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const text = await r.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch (e) { data = text; }
          applyResults.push({ endpoint: call.endpoint, ok: r.ok, status: r.status, response: data });

          // If we just created an itinerary item and the original item had a local_id, map it
          if (r.ok && call.endpoint === '/api/dev/addItineraryItem') {
            // data should be the created item object and include id
            if (data && data.id && payload.item && payload.item.local_id) {
              localIdMap[String(payload.item.local_id)] = String(data.id);
            }
          }
        } catch (e: any) {
          applyResults.push({ endpoint: call.endpoint, ok: false, error: String(e?.message || e) });
        }
      }
      result.updatesApplied = applyResults;
    }

    return res.status(200).json(result);
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e), debugRequest });
  }
}
