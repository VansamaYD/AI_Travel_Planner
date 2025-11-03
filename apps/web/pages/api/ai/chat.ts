import type { NextApiRequest, NextApiResponse } from 'next';
import { createTrip, addItineraryItem } from '../../../lib/api';

// Note: this proxy intentionally avoids loading the OpenAI SDK.
// We target 阿里云 Dashscope / 通义千问 via fetch to the compatible endpoint.

// Simple proxy endpoint for calling a model API (e.g., 通义千问/Tongyi Qianwen).
// Behavior:
// - Accepts POST { message: string, apiKey?: string, apiUrl?: string, tripId?: string }
// - Uses server env TONGYI_API_URL / TONGYI_API_KEY if present, otherwise uses provided apiKey/apiUrl from body
// - If no api key / url available, returns 400 so client can prompt user to input one

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // capture debugRequest across try/catch so errors can also surface the attempted request
  let debugRequest: any = null;

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    const { message, apiKey: bodyApiKey, apiUrl: bodyApiUrl } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'missing message' });

  // Prefer server-side Dashscope/Tongyi config, then client-provided values.
  // Order of precedence for apiKey: DASHSCOPE_API_KEY (server) -> TONGYI_API_KEY -> body provided
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.TONGYI_API_KEY || bodyApiKey;

  // Determine apiUrl. Prefer explicit Dashtscope/Tongyi base URLs from env or body.
  // Default to Dashscope's public compatible endpoint so the app works out-of-the-box
  // against 阿里云 Dashscope when no apiUrl is provided.
  const apiUrl = process.env.DASHSCOPE_BASE_URL || process.env.TONGYI_API_URL || bodyApiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

    if (!apiUrl) {
      return res.status(400).json({ error: 'no_api_configured', message: '请在页面中输入 API Key 和 API Base URL，或在服务端配置 TONGYI_API_URL / TONGYI_API_KEY / DASHSCOPE_API_KEY' });
    }

    // If mode=plan, we will instruct the model to return a structured JSON matching a trip schema.
    const mode = req.body?.mode || 'chat';

    let prompt = message;
    if (mode === 'plan') {
      // For plan mode we keep the user's requirement in `prompt` but will supply a stricter
      // system message describing the exact createTrip JSON schema when constructing
      // the messages sent to the upstream model (see messages construction below).
      prompt = `用户需求：\n${message}`;
    }

  // We do not use an OpenAI SDK here; we'll call Dashscope / compatible endpoint via fetch.
  let upstreamResp: any = null;
  let usedSdk = false;

    // Build request to 阿里云 Dashscope / 通义兼容 endpoint
    // Dashscope / 通义兼容: ensure target endpoint ends with /chat/completions
    const base = String(apiUrl || process.env.TONGYI_API_URL || '');
    let target = base;
    if (!/\/chat\/.+/.test(base)) {
      // append chat/completions if missing
      target = base.replace(/\/$/, '') + '/chat/completions';
    }

    // Build a body compatible with Dashscope / compatible-mode
    const defaultUserMsg = { role: 'user', content: [{ type: 'text', text: prompt }] };
    let messagesForBody: any = req.body?.messages || [defaultUserMsg];
    if (mode === 'plan') {
      // system message describing the exact JSON schema we expect for createTrip
        const systemText = `你是一个旅行规划助手。

严格要求：
- 只输出一个有效的 JSON（不要包含 Markdown、注释或额外说明）。
- 顶层必须是一个 Trip 对象（详见下方 schema）。如果你无法提供某个字段，使用 null 作为占位。

以下是我们在后端/前端中使用的精确字段说明（请严格遵循字段名和类型）：

Trip 对象（必须返回）：
{
  "title": string,                     // 行程标题，非空字符串
  "start_date": "YYYY-MM-DD",       // 行程开始日期，严格格式
  "end_date": "YYYY-MM-DD",         // 行程结束日期，严格格式
  "days": [                           // 可选：按天分组的日程（可省略或空数组）
    {
      "date": "YYYY-MM-DD" | undefined,
      "items": [                       // 可选：当天的行程条目数组
        {
          "id": string | undefined,    // 可选，若创建前不需要可省略
          "trip_id": string | undefined,
          "day_index": number | undefined,
          "title": string,             // 条目标题（必填）
          "date": "YYYY-MM-DD",      // 所属日期（必填）
          "start_time": "HH:MM" | null | undefined,
          "end_time": "HH:MM" | null | undefined,
          "notes": string | null | undefined,
          "description": string | null | undefined,
          "type": string | null | undefined,
          "location": {                 // 可选位置对象
            "lat": number | undefined,
            "lng": number | undefined,
            "address": string | undefined
          } | null | undefined,
          "est_cost": number | null | undefined,
          "actual_cost": number | null | undefined,
          "currency": string | null | undefined,
          "sequence": number | undefined,
          "extra": any | undefined
        }
      ]
    }
  ] | undefined,
  "owner_id": string | null | undefined, // 前端会用当前用户 id 填充；允许返回 null
  "description": string | null | undefined,
  "estimated_budget": number | null | undefined,
  "currency": string | undefined,
  "status": string | undefined,
  "visibility": string | undefined,
  "collaborators": [string] | undefined,
  "metadata": any | undefined,
  // 下面是可选的只读/返回字段：created_at、updated_at 等可包含也可省略
  "created_at": string | undefined,
  "updated_at": string | undefined
}

Expense 对象（若模型建议预算分配或费用清单，请返回一个 expenses 数组，项结构如下）：
{
  "id": string | undefined,
  "trip_id": string | undefined,
  "itinerary_item_id": string | null | undefined,
  "amount": number,                 // 必填数字
  "currency": string,               // 如 "CNY"
  "payer_id": string | undefined,
  "user_id": string | undefined,
  "note": string | null | undefined, // 用于自由文本备注
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

输出约定（重要）：
- 请只输出一个 JSON 对象。这个对象应该是 Trip（包含可选的 days->items）并且可以包含一个名为 "expenses" 的数组（若有费用建议）。
- 示例形态（严格）：
  {
    "title": "三亚亲子游",
    "start_date": "2025-12-10",
    "end_date": "2025-12-14",
    "estimated_budget": 8000,
    "currency": "CNY",
    "description": "4 人，含机票和酒店、部分活动",
    "owner_id": null,
    "days": [
      {
        "date": "2025-12-10",
        "items": [
          {
            "title": "到达并入住酒店",
            "date": "2025-12-10",
            "start_time": "15:00",
            "end_time": null,
            "description": "接机后入住酒店，休息",
            "location": { "address": "三亚湾某酒店" },
            "est_cost": 500,
            "currency": "CNY"
          }
        ]
      }
    ],
    "expenses": [
      { "amount": 1200, "currency": "CNY", "description": "往返机票（4人）", "date": "2025-12-10" }
    ]
  }

额外说明：
- 字段名必须精确匹配上述 schema，日期使用 YYYY-MM-DD，时间使用 HH:MM（24 小时制）或 null。
- 对于缺失信息用 null（或可选地省略字段）。
- 如果返回多个资源（例如单独返回 expenses），也请把它们作为 Trip 对象的属性（例如 "expenses": [...]）。
- 不要返回带有解释文本的答案；如果无法按要求输出 JSON，请仅返回一个空对象 {} 或明确的 JSON 错误对象，例如 {"error": "cannot_generate_json"}。

额外提示（关于新建条目和费用的引用）：
- 如果在 'days' -> 'items' 中创建新的 itinerary item，并且希望在 'expenses' 中引用它，请在该 item 中加入临时字段 'local_id'（例如 "local_1"），并在对应的 expense 的 'itinerary_item_id' 中引用这个 'local_id'。客户端或服务器在创建这些资源时应先创建 items、捕获真实 id 并把 'local_id' 替换为真实 id 后再创建依赖的 expenses。

前端行为提示：前端会解析此 JSON，并在本地将 current user 的 id 填入 owner_id，然后依次调用 dev endpoint 来持久化 trip、itinerary items 与 expense 条目。
`;
      const systemMsg = { role: 'system', content: [{ type: 'text', text: systemText }] };
      messagesForBody = [systemMsg, defaultUserMsg];
    }

    const bodyObj: any = {
      model: req.body?.model || 'qwen3-vl-32b-thinking',
      messages: messagesForBody,
      stream: req.body?.stream || false,
      stream_options: req.body?.stream_options || undefined,
      enable_thinking: typeof req.body?.enable_thinking !== 'undefined' ? req.body.enable_thinking : (mode === 'plan' ? true : undefined),
      thinking_budget: req.body?.thinking_budget || undefined,
    };

    // record debug request (no auth)
    debugRequest = { target, body: bodyObj };

    if (bodyObj.stream) {
      // For now, return instructive error so client can retry with stream=false for testing
      upstreamResp = { ok: false, error: 'stream_not_supported', message: '当前代理不支持 stream=true 的流式转发，请将 stream=false 或使用专用流式端点' } as any;
    } else {
      upstreamResp = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
      }).catch((e) => ({ ok: false, error: String(e) } as any));
    }

    // Normalize upstream error reporting: if fetch returned a Response with non-ok, include status and body text
    if (!upstreamResp) {
      return res.status(502).json({ error: 'upstream_error', message: '无法连接到上游模型 API', detail: null, debugRequest });
    }

    // If upstreamResp was set to an object with .ok=false and .error, surface it
    if ((upstreamResp as any).ok === false && (upstreamResp as any).error) {
      return res.status(502).json({ error: 'upstream_error', message: '无法连接到上游模型 API', detail: (upstreamResp as any).error, debugRequest });
    }

    // If upstreamResp looks like a Fetch Response, but is not ok, read body for diagnostics
    try {
      const maybeStatus = (upstreamResp as any).status;
      const maybeOk = (upstreamResp as any).ok;
      if (typeof maybeOk === 'boolean' && maybeOk === false) {
  let detailBody: any = null;
        try {
          detailBody = await (upstreamResp as any).text();
        } catch (e) {
          detailBody = String(e?.message || e);
        }
        return res.status(502).json({ error: 'upstream_error', message: `上游返回 ${maybeStatus}`, detail: detailBody });
      }
    } catch (e) {
      // ignore
    }

    const contentType = upstreamResp.headers?.get?.('content-type') || '';
    let bodyText = '';
    if (usedSdk) {
      bodyText = upstreamResp.content ?? JSON.stringify(upstreamResp.raw ?? upstreamResp);
    } else {
      if (contentType.includes('application/json')) {
        const data = await upstreamResp.json();

        // Robust extraction of model text across providers and response shapes.
        const extractModelTextFromPayload = (payload: any): string => {
          if (!payload) return '';
          if (typeof payload === 'string') return payload;
          // common direct fields
          if (typeof payload.output?.text === 'string') return payload.output.text;
          if (typeof payload.data?.text === 'string') return payload.data.text;
          if (typeof payload.result === 'string') return payload.result;
          if (typeof payload.text === 'string') return payload.text;

          // OpenAI-like choices array
          if (Array.isArray(payload.choices) && payload.choices.length) {
            const c = payload.choices[0];
            // choices[].text (older OpenAI style)
            if (typeof c.text === 'string') return c.text;
            // choices[].message can be object with content string or array
            if (c.message) {
              if (typeof c.message === 'string') return c.message;
              // some providers use message.content as a string
              if (typeof c.message.content === 'string') return c.message.content;
              // some providers use content as array of {type,text}
              if (Array.isArray(c.message.content)) {
                return c.message.content.map((p: any) => (p?.text ?? '')).join('\n');
              }
              // some providers nest content under message.content[0].text
              if (Array.isArray(c.message?.content) && c.message.content.length && typeof c.message.content[0].text === 'string') {
                return c.message.content[0].text;
              }
            }
            // some providers wrap assistant and reasoning in choices[].message.reasoning_content
            if (typeof c.message?.reasoning_content === 'string') return c.message.reasoning_content;
          }

          // Fallback: try common nested fields
          if (Array.isArray(payload.results) && payload.results.length) {
            const r = payload.results[0];
            if (typeof r?.content === 'string') return r.content;
            if (Array.isArray(r?.content)) return r.content.map((p: any) => p.text ?? '').join('\n');
          }

          return JSON.stringify(payload);
        };

        bodyText = extractModelTextFromPayload(data || {});
      } else {
        // fallback: plain text
        bodyText = await upstreamResp.text();
      }
    }

    // If mode=plan, try to extract JSON from model output and create trip + items on server
    if (mode === 'plan') {
      // try parse as JSON directly
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(bodyText);
      } catch (e) {
        // Try to extract first JSON object substring
        const m = bodyText.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsedJson = JSON.parse(m[0]); } catch (e) { parsedJson = null; }
        }
      }

      if (!parsedJson) {
        return res.status(502).json({ error: 'model_returned_non_json', text: bodyText, message: '模型未返回可解析的 JSON，请检查模型或调整 prompt', debugRequest });
      }

      // Sanitize parsed JSON to align with DB column names and avoid sending unexpected fields
      // 1) Expenses: map legacy `description` -> `note` and whitelist allowed expense keys
      const allowedExpenseKeys = ['id','trip_id','itinerary_item_id','user_id','amount','currency','category','date','note','recorded_via','raw_transcript','created_at','payer_id','status','payment_method','vendor','receipt_url','split'];
      if (Array.isArray(parsedJson.expenses)) {
        parsedJson.expenses = parsedJson.expenses.map((raw: any) => {
          const item = { ...(raw || {}) };
          if (item.description && !item.note) item.note = item.description;
          const out: any = {};
          for (const k of Object.keys(item)) {
            if (allowedExpenseKeys.includes(k)) out[k] = item[k];
          }
          return out;
        });
      }

      // 2) Itinerary items: whitelist keys based on itinerary_items columns
      const allowedItemKeys = ['id','trip_id','day_index','date','start_time','end_time','title','type','description','notes','location','est_cost','actual_cost','currency','sequence','created_at','updated_at','extra'];
      if (Array.isArray(parsedJson.days)) {
        parsedJson.days = parsedJson.days.map((d: any) => {
          if (!d || typeof d !== 'object') return d;
          if (!Array.isArray(d.items)) return d;
          const safeItems = d.items.map((it: any) => {
            const out: any = {};
            for (const k of Object.keys(it || {})) {
              if (allowedItemKeys.includes(k)) out[k] = it[k];
            }
            return out;
          });
          return { ...d, items: safeItems };
        });
      }

      // Instead of creating resources on the server, return the parsed structured JSON to the client
      // so the client can locally assign owner_id and call the dev endpoints to persist data.
      return res.status(200).json({ ok: true, parsed: parsedJson, rawModelText: bodyText, debugRequest });
    }

    return res.status(200).json({ ok: true, text: bodyText, debugRequest });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e), debugRequest });
  }
}
