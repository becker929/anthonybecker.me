// Minimal in-memory stand-ins for the D1 and R2 bindings, implementing only
// the methods src/cards.js and src/blobs.js actually call. Good enough to
// unit-test the route handlers' logic without wrangler/Miniflare.

export class FakeD1 {
  constructor() {
    this.cards = new Map(); // id -> { id, schema_version, json, updated_at }
    this.interactions = [];
    this.gems = new Map(); // id -> row shape matching the gems table columns
    this.prompts = new Map(); // id -> { id, generator, version, text, created_at }
    this.skills = new Map(); // id -> { id, name, text, updated_at }
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
    } else if (sql.includes("INSERT INTO gems")) {
      const [id, name, palette, key_color, raw_hash, mask_params, created_at] = args;
      this.gems.set(id, { id, name, palette, key_color, raw_hash, mask_params, approved: 0, created_at });
    } else if (sql.includes("UPDATE gems SET mask_params")) {
      const [mask_params, id] = args;
      const row = this.gems.get(id);
      if (row) row.mask_params = mask_params;
    } else if (sql.includes("UPDATE gems SET approved")) {
      const [id] = args;
      const row = this.gems.get(id);
      if (row) row.approved = 1;
    } else if (sql.includes("INSERT INTO prompts")) {
      const [id, generator, version, text, created_at] = args;
      this.prompts.set(id, { id, generator, version, text, created_at });
    } else if (sql.includes("INSERT INTO skills")) {
      const [id, name, text, updated_at] = args;
      this.skills.set(id, { id, name, text, updated_at });
    } else if (sql.includes("UPDATE skills SET")) {
      const [name, text, updated_at, id] = args;
      const row = this.skills.get(id);
      if (row) Object.assign(row, { name, text, updated_at });
    } else if (sql.includes("DELETE FROM skills")) {
      const [id] = args;
      this.skills.delete(id);
    } else {
      throw new Error(`FakeD1: unhandled run() for: ${sql}`);
    }
  }

  _first(sql, args) {
    if (sql.includes("SELECT json FROM cards WHERE id")) {
      const row = this.cards.get(args[0]);
      return row ? { json: row.json } : null;
    }
    if (sql.includes("SELECT * FROM gems WHERE id")) {
      return this.gems.get(args[0]) || null;
    }
    if (sql.includes("SELECT COUNT(*) as count FROM prompts WHERE generator")) {
      const count = [...this.prompts.values()].filter((r) => r.generator === args[0]).length;
      return { count };
    }
    if (sql.includes("FROM prompts WHERE generator = ? AND version = ?")) {
      const [generator, version] = args;
      return [...this.prompts.values()].find((r) => r.generator === generator && r.version === version) || null;
    }
    if (sql.includes("FROM prompts WHERE generator = ? ORDER BY version DESC")) {
      const rows = [...this.prompts.values()].filter((r) => r.generator === args[0]).sort((a, b) => b.version - a.version);
      return rows[0] || null;
    }
    if (sql.includes("FROM skills WHERE id = ?")) {
      return this.skills.get(args[0]) || null;
    }
    if (sql.includes("FROM skills WHERE name = ?")) {
      return [...this.skills.values()].find((r) => r.name === args[0]) || null;
    }
    throw new Error(`FakeD1: unhandled first() for: ${sql}`);
  }

  _all(sql, args) {
    if (sql.includes("SELECT id, json, updated_at FROM cards")) {
      const results = [...this.cards.values()]
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        .map(({ id, json, updated_at }) => ({ id, json, updated_at }));
      return { results };
    }
    if (sql.includes("SELECT * FROM gems")) {
      let rows = [...this.gems.values()];
      if (sql.includes("WHERE approved = 1")) rows = rows.filter((r) => r.approved === 1);
      rows = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { results: rows };
    }
    if (sql.includes("FROM prompts WHERE generator = ? ORDER BY version DESC")) {
      const rows = [...this.prompts.values()].filter((r) => r.generator === args[0]).sort((a, b) => b.version - a.version);
      return { results: rows };
    }
    if (sql.includes("FROM skills")) {
      const rows = [...this.skills.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
      return { results: rows };
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

// Minimal stand-in for a Workers KV namespace binding: get/put/list only,
// with list() supporting a prefix and a cursor so pagination logic (like
// src/listen.js's export handler) can actually be exercised.
export class FakeKV {
  constructor() {
    this.store = new Map(); // key -> string value
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async list({ prefix = "", cursor, limit = 1000 } = {}) {
    const allKeys = [...this.store.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = allKeys.slice(start, start + limit);
    const list_complete = start + limit >= allKeys.length;
    const result = { keys: page.map((name) => ({ name })), list_complete };
    if (!list_complete) result.cursor = String(start + limit);
    return result;
  }
}
