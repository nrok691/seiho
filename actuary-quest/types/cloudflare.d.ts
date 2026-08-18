/// <reference types="@cloudflare/workers-types" />

// `cloudflare:workers` の importable env が参照する、アプリ固有のbinding。
// Workersランタイムの型本体は上の公式パッケージから取得する。
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}
