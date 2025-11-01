const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const root = process.cwd();
const outPath = path.join(root, 'public', 'openapi.json');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AI Travel Planner - Dev API (generated)',
      version: '0.1.0',
      description: 'Generated OpenAPI spec from JSDoc annotations (swagger-jsdoc).'
    },
    servers: [{ url: '/' }],
  },
  apis: [path.join(root, 'pages', 'api', '**', '*.ts'), path.join(root, 'pages', 'api', '**', '*.js')],
};

try {
  const spec = swaggerJSDoc(options);
  // Attempt to merge Zod-derived JSON Schemas (if available)
  try {
    // Prefer generated schemas under scripts/generated to avoid coupling to src JS artifacts.
    const preferredSchemas = path.join(root, 'scripts', 'generated', 'schemas.js');
    const fallbackSchemas = path.join(root, 'lib', 'schemas.js');
    const schemasPath = fs.existsSync(preferredSchemas) ? preferredSchemas : fallbackSchemas;
    if (fs.existsSync(schemasPath)) {
      const zSchemas = require(schemasPath);
      spec.components = spec.components || {};
      spec.components.schemas = spec.components.schemas || {};
      const incoming = zSchemas.components || {};
      // Normalize zod-to-json-schema output: if a schema is a wrapper with definitions and $ref,
      // extract the actual definition object for OpenAPI-friendly components.schemas
      for (const [name, val] of Object.entries(incoming)) {
        if (val && typeof val === 'object' && val.definitions && typeof val.$ref === 'string') {
          const ref = String(val.$ref);
          const m = ref.match(/#\/definitions\/(.+)$/);
          if (m) {
            const defName = m[1];
            const defObj = val.definitions && val.definitions[defName];
            if (defObj) {
              spec.components.schemas[name] = defObj;
              continue;
            }
          }
        }
        // fallback: copy value as-is
        spec.components.schemas[name] = val;
      }
    }
  } catch (e) {
    console.warn('Failed to merge Zod schemas into OpenAPI spec:', e?.message || e);
  }

  // Inject sensible `required` lists and `example` objects for better Swagger UI usability.
  try {
    spec.components = spec.components || {};
    spec.components.schemas = spec.components.schemas || {};

    // Expense
    if (spec.components.schemas.Expense) {
      const s = spec.components.schemas.Expense;
      // payer_id is optional — do not force it as required
      s.required = s.required || [ 'amount', 'currency' ];
      // Use a realistic UUID in the example for payer_id (Postgres expects UUIDs)
      s.example = s.example || {
        id: 'exp_abc123',
        trip_id: '11111111-1111-1111-1111-111111111111',
        itinerary_item_id: null,
        user_id: null,
        amount: 42.5,
        currency: 'USD',
        payer_id: '00000000-0000-0000-0000-000000000001',
        description: 'Lunch at local cafe',
        note: 'Lunch at local cafe',
        payment_method: null,
        vendor: null,
        receipt_url: null,
        raw_transcript: null,
        split: null,
        date: '2025-10-31',
        category: null,
        status: 'pending',
        recorded_via: 'web',
        created_at: '2025-10-31T00:00:00.000Z'
      };
    }

    // ItineraryItem
    if (spec.components.schemas.ItineraryItem) {
      const s = spec.components.schemas.ItineraryItem;
      s.required = s.required || [ 'title', 'date' ];
      s.example = s.example || {
        id: 'item_1',
        title: 'Visit the museum',
        date: '2025-11-01',
        start_time: '10:00',
        notes: 'Buy tickets online'
      };
    }

    // Trip
    if (spec.components.schemas.Trip) {
      const s = spec.components.schemas.Trip;
      s.required = s.required || [ 'title', 'start_date', 'end_date' ];
      s.example = s.example || {
  id: '5d18dbff-234d-4e95-b877-670b9bc0e4ae',
  owner_id: '11111111-1111-1111-1111-111111111111',
  title: 'Beijing Weekend',
  description: 'A short weekend trip to Beijing',
  start_date: '2025-11-01',
  end_date: '2025-11-03',
  estimated_budget: 5000,
  currency: 'CNY',
  status: 'draft',
  visibility: 'private',
  collaborators: [],
  created_at: '2025-10-31T10:57:14.25548+00:00',
  updated_at: '2025-10-31T10:57:14.25548+00:00',
  metadata: {},
  estimated_budget_consumed: 0,
  last_budget_recalc_at: '2025-10-31T00:00:00.000Z',
  estimated_budget_remaining: 5000
      };
    }
  } catch (e) {
    console.warn('Failed to inject examples/required into components:', e?.message || e);
  }

  // If the path-level JSDoc provided a detailed `item` schema (requestBody), but the
  // merged Zod-derived components.schemas.ItineraryItem is missing some fields,
  // copy the item.properties into components.schemas.ItineraryItem so Swagger shows full shape.
  try {
    const pathItem = spec.paths && spec.paths['/api/dev/addItineraryItem'] && spec.paths['/api/dev/addItineraryItem'].post;
    const itemSchemaProps = pathItem && pathItem.requestBody && pathItem.requestBody.content && pathItem.requestBody.content['application/json'] && pathItem.requestBody.content['application/json'].schema && pathItem.requestBody.content['application/json'].schema.properties && pathItem.requestBody.content['application/json'].schema.properties.item && pathItem.requestBody.content['application/json'].schema.properties.item.properties;
    if (itemSchemaProps && spec.components && spec.components.schemas && spec.components.schemas.ItineraryItem) {
      const comp = spec.components.schemas.ItineraryItem;
      comp.properties = comp.properties || {};
      for (const [k, v] of Object.entries(itemSchemaProps)) {
        // if property missing in component schema, copy it over
        if (!Object.prototype.hasOwnProperty.call(comp.properties, k)) {
          comp.properties[k] = v;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to merge path item schema into components.ItineraryItem:', e?.message || e);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
  console.log('Generated OpenAPI spec at', outPath);
} catch (err) {
  console.error('Failed to generate OpenAPI spec', err);
  process.exit(2);
}
