# Rekomendasi Pengembangan dawu-manager

> Disusun 2026-07-11 setelah audit lengkap API dawos-agent (live OpenAPI accel-2)
> dan verifikasi seluruh halaman di browser terhadap node production.
> Bahasa: Indonesia untuk narasi, English untuk kode/path/endpoint.

## Ringkasan status saat ini

| Aspek | Status |
|-------|--------|
| Surface API dawos-agent | **150 endpoint / 30 modul / 67 endpoint write** (lihat `docs/API_COVERAGE.md`) |
| Yang dikonsumsi UI | ~64 path — mayoritas **read**, baru sebagian kecil write |
| Fitur create/edit | Baru ada di 6 halaman (network route/VLAN, pppoe interface/MAC-filter, firewall validate, ip-pool add, config check, monitoring exporter) |
| Real-time | Chart traffic (SSE) ✅ · WebSocket `/ws/events` **belum dikonsumsi** |
| Alerting | **Belum ada** |
| Kualitas | 786 test, 100% coverage, lint clean, build pass |

**Prinsip utama rekomendasi ini:** jangan menambah fitur baru sebelum fitur write
yang sudah ada terbukti benar terhadap node sungguhan. Ini infrastruktur ISP
production — pelanggan nyata bisa terputus oleh operasi yang salah.

---

## PRIORITAS 1 — Perbaiki & buktikan yang sudah ada (kecil, wajib duluan)

### 1a. Bug refresh-setelah-mutasi (correctness) — **effort: kecil (~1 file)**

`useNodeProxyMutation` meng-invalidasi query dengan key satu-segmen, sedangkan
TanStack Query mencocokkan `queryKey` **elemen-per-elemen**. Filter
`["node-proxy", id, "monitoring"]` **tidak** cocok dengan query
`["node-proxy", id, "monitoring/status"]`. Akibatnya beberapa halaman **tidak
me-refresh data setelah mutasi**.

Hasil sisir `invalidates` satu-segmen (14 titik). Yang **benar-benar bug** (data
utama multi-segmen):

| Halaman | `invalidates` | Query yang ditampilkan | Dampak |
|---------|---------------|------------------------|--------|
| `service` | `["service"]` | `service/status` | Status tak refresh setelah start/stop/restart |
| `dhcp` | `["dhcp"]` | `dhcp/status` | Status tak refresh setelah restart |
| `events` | `["events"]` | `events/hooks`, `events/history` | List tak refresh (diflag net-crud) |
| `monitoring` | `["monitoring"]` | `monitoring/status`, `monitoring/metrics` | **Diperkenalkan saat rewrite kemarin** — enable/disable exporter tak refresh status |

Yang **minor** (data utama single-segmen ikut ter-refresh, hanya sub-query yang
tidak): `config` (backups/revisions), `ip-pool` (usage tile), `sessions`
(stats), `playbooks` (aman, single-segmen).

**Fix yang disarankan (sistemik, elegan):** ubah invalidasi di
`src/hooks/use-node-proxy.ts` menjadi **prefix-aware** — cocokkan berdasarkan
segmen pertama path. Contoh predikat:

```ts
queryClient.invalidateQueries({
  predicate: (q) => {
    const k = q.queryKey; // ["node-proxy", nodeId, "monitoring/status"]
    if (k[0] !== "node-proxy" || k[1] !== nodeId) return false;
    const seg0 = String(k[2]).split("/")[0];
    return prefixes.has(seg0); // prefixes berisi first-segment dari path + invalidates
  },
});
```

Dengan ini `["monitoring"]` otomatis me-refresh `monitoring/status` **dan**
`monitoring/metrics` — satu perubahan membenahi semua halaman. Setelah fix,
sederhanakan `invalidates` di semua page menjadi first-segment saja dan hapus
work-around path-eksak yang dipakai net-crud/svc-crud (opsional; keduanya tetap
benar).

### 1b. Uji fitur write ke node DEV — **effort: sedang (manual + fix temuan)**

~15 fitur write dibangun tapi **nol ditembakkan** ke node (demi keamanan
production). Mock tidak bisa membuktikan bentuk request/respons benar — crash
`firewall/sysctl` (object vs string) membuktikan ini.

**Rencana:** deploy dawu-manager menunjuk ke **dawos-dev (192.168.216.99:8470)**,
lalu jalankan tiap operasi write sungguhan dan verifikasi:
- POST `network/routes`, `network/vlans`, `pppoe/interfaces`, `pppoe/mac-filter`,
  `ip-pool`, `traffic/ratelimit/{user}`
- DELETE pasangannya
- `firewall/validate`, `firewall/save`, `config/apply` (+ guard-timer + confirm)
- `monitoring/configure`, `sessions/terminate`, `service/{action}`

Perbaiki request body / handling error yang meleset. **Jangan uji di accel-2.**

### 1c. Guardrail aksi destruktif — **effort: kecil–sedang**

Untuk BNG production, seragamkan konfirmasi aksi yang memutus pelanggan:
- `sessions/terminate`, `service/{action}`, `firewall/save`, `config/apply` →
  dialog yang menyebut dampak eksplisit ("N sesi aktif akan terputus").
- Pertimbangkan mode "preview/dry-run" untuk config (pakai `config/diff`).

---

## PRIORITAS 2 — Pembeda utama sebuah NOC tool: real-time + alerting

Ini alasan sesungguhnya memakai dashboard alih-alih SSH, dan **belum ada**.

### 2a. Live event feed via WebSocket `/ws/events` — **effort: sedang**
Agent mengekspos `/ws/events` (channel real-time) tapi **tidak dikonsumsi** di
mana pun. Bangun:
- BFF WebSocket proxy (mirip SSE passthrough yang sudah ada) — key server-side.
- Panel activity feed live lintas node: subscriber up/down, perubahan config,
  event handler ter-trigger. Filter per channel/node.

### 2b. Alert rules & history — **effort: besar (fitur milestone)**
UI set threshold per node: node offline, CPU>90%, jumlah sesi < X (mass
disconnect), traffic spike/anjlok. Trigger: webhook agent / Telegram / email.
Timeline history alert. **Ini killer feature untuk operator NOC yang jaga malam.**

---

## PRIORITAS 3 — Lengkapi surface manajemen (~50 write endpoint tanpa UI)

Urut berdasarkan nilai operasional harian ISP (detail skema di `docs/API_COVERAGE.md`):

1. **Bulk ops** — `POST bulk/terminate`, `bulk/ratelimit`, `bulk/shaper-restore`.
   Aksi massal ke banyak subscriber sekaligus. Roti-mentega ISP.
2. **DNS forwarding** — `PUT dns/forwarding/config {servers,cache_size}`,
   `POST dns/forwarding/flush`.
3. **Firewall lanjutan** — NAT egress/masquerade/public-ip CRUD, groups CRUD,
   `PUT firewall/sysctl`, `PUT firewall/conntrack`.
4. **Scheduler** — jobs CRUD + run (`scheduler/jobs`), untuk automation.
5. **Zone firewall** — `POST/DELETE zones`.
6. **VRRP** — `POST vrrp/failover`, `vrrp/restart` (untuk pasangan HA).
7. **Conntrack tuning**, **limits** (`PUT limits`), **event hooks CRUD**.

---

## PRIORITAS 4 — Karena intinya multi-node

### 4a. Operasi lintas-node — **effort: besar**
Pilih beberapa node → apply config / jalankan playbook / bulk action serentak.
Inilah yang membuat "fleet manager" bernilai vs mengelola satu-satu.

### 4b. Audit trail sungguhan — **effort: sedang**
Model `AuditLog` + `Setting` sudah ada di schema dan proxy sudah mencatat mutasi,
tapi halaman `/audit` masih tipis. Buat viewer yang bisa **difilter** (user, node,
aksi, rentang waktu) dan **diekspor CSV**. Penting untuk tim multi-operator +
kepatuhan.

### 4c. Dashboard overview agregat
Statistik lintas node sungguhan di landing page: total subscriber aktif, total
throughput, jumlah node online/degraded/offline, top node by load.

---

## PRIORITAS 5 — Utang teknis & UX tertunda

- **3 vulnerability moderate** di dependency (`pnpm audit`) — postcss (via next),
  @hono/node-server (via prisma dev). Pakai `pnpm.overrides` atau tunggu upstream.
- **React Query retry-on-404**: section yang 404 menampilkan skeleton beberapa
  detik sebelum catatan "Not available". Matikan retry untuk 4xx di hook agar
  catatan tenang muncul instan (hati-hati: test hook mengandalkan `retry:false`).
- Deferred (milestone berikut): **topology map** (React Flow), **onboarding
  wizard** (node pertama + test koneksi), **PWA** (offline NOC), **i18n**
  (struktur EN/ID), **web terminal** (xterm.js), **API playground**.

---

## Peta prioritas (ringkas)

| # | Item | Effort | Nilai | Status |
|---|------|--------|-------|--------|
| P1a | Fix invalidasi prefix-aware | Kecil | Tinggi | ✅ Selesai (`b60ed4d`) |
| P1b | Uji write di dawos-dev | Sedang | Tinggi | ⏸️ Butuh Anda — deploy dawu-manager → dawos-dev + API key dev |
| P1c | Guardrail aksi destruktif | Kecil–sedang | Tinggi | ✅ Selesai (`6e0bdfe`) — config/apply, firewall/save, service restart |
| P2a | Live event feed (feed aktivitas) | Sedang | Tinggi | ✅ Selesai (`d53134e`) — `/audit`, poll AuditLog* |
| P2b | Alert rules & history | Besar | Sangat tinggi | ✅ Selesai (`d71c320`) — `/alerts`, rules CRUD + evaluator + webhook |
| P3 | Sisa ~50 write endpoint | Besar (bertahap) | Sedang–tinggi | ⏭️ Ditunda (butuh perbaikan dawos-agent) |
| P4a | Operasi lintas-node | Besar | Tinggi | ⬜ Belum |
| P4b | Audit trail | Sedang | Sedang–tinggi | ✅ Selesai — filter by user/node/action/date-range + CSV export |
| P4c | Dashboard overview agregat | Sedang | Sedang–tinggi | ✅ Selesai — live fleet stats, top nodes by load, graceful degradation |
| P5 | Vuln + polish | Kecil | Sedang | ⬜ Belum |

> \* P2a memakai polling AuditLog, bukan WebSocket `/ws/events`: WS tak bisa
> di-proxy di Next standalone tanpa custom server, dan agent belum expose SSE
> untuk event. Upgrade ke WS jadi item tersendiri jika dibutuhkan nanti.

---

## Mulai dari mana (rekomendasi tegas)

1. **P1a** — fix invalidasi prefix-aware (kecil, membenahi bug nyata termasuk yang
   diperkenalkan di monitoring). Aman, cepat, tanpa risiko production.
2. **P1b** — sambil itu, uji fitur write di **dawos-dev** dan perbaiki yang meleset.
3. Baru lanjut ke **P2 (real-time + alerting)** sebagai lompatan nilai terbesar.

Referensi teknis: `docs/API_COVERAGE.md` (skema semua endpoint) ·
`docs/DESIGN.md` (kontrak desain) · `docs/NODE_PAGES_FIX.md` (data-truth per page).
