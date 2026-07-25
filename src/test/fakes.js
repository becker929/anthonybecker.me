// Minimal in-memory stand-ins for the D1 and R2 bindings, implementing only
// the methods src/cards.js and src/blobs.js actually call. Good enough to
// unit-test the route handlers' logic without wrangler/Miniflare.

export class FakeD1 {
  constructor() {
    this.cards = new Map(); // id -> { id, schema_version, json, updated_at }
    this.interactions = [];
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async run() {
            db._run(sql, args);
          },
          async first() {
            return db._first(sql, args);
          },
          async all() {
            return db._all(sql, args);
          },
        };
      },
      async all() {
        return db._all(sql, []);
      },
    };
  }

  _run(sql, args) {
    if (sql.includes("INSERT INTO cards")) {
      const [id, schema_version, json, updated_at] = args;
      this.cards.set(id, { id, schema_version, json, updated_at });
    } else if (sql.includes("INSERT INTO interactions")) {
      const [id, card_id, seq, instruction, asset_hash, created_at] = args;
      this.interactions.push({ id, card_id, seq, instruction, asset_hash, created_at });
    } else {
      throw new Error(`FakeD1: unhandled run() for: ${sql}`);
    }
  }

  _first(sql, args) {
    if (sql.includes("SELECT json FROM cards WHERE id")) {
      const row = this.cards.get(args[0]);
      return row ? { json: row.json } : null;
    }
    throw new Error(`FakeD1: unhandled first() for: ${sql}`);
  }

  _all(sql) {
    if (sql.includes("SELECT id, json, updated_at FROM cards")) {
      const results = [...this.cards.values()]
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .map(({ id, json, updated_at }) => ({ id, json, updated_at }));
      return { results };
    }
    throw new Error(`FakeD1: unhandled all() for: ${sql}`);
  }
}

export class FakeR2 {
  constructor() {
    this.store = new Map(); // key -> { bytes: Uint8Array, httpMetadata }
  }

  async put(key, bytes, opts) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.store.set(key, { bytes: arr, httpMetadata: opts?.httpMetadata });
  }

  async head(key) {
    return this.store.has(key) ? {} : null;
  }

  async get(key) {
    const obj = this.store.get(key);
    if (!obj) return null;
    return {
      httpMetadata: obj.httpMetadata,
      async arrayBuffer() {
        return obj.bytes.buffer.slice(obj.bytes.byteOffset, obj.bytes.byteOffset + obj.bytes.byteLength);
      },
    };
  }
}
