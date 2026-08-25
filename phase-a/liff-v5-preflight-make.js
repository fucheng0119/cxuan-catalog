"use strict";

// CXUAN_PREFLIGHT_CORE_START
const CAP_MINOR = Object.freeze({ branch: 30000000, wh: 50000000 });
const DEST_RE = /^[CUR][0-9a-f]{32}$/;

function moneyMinor(value) {
  const raw = typeof value === "number" ? String(value) : String(value ?? "").trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const minor = Math.round(numeric * 100);
  if (Math.abs(numeric * 100 - minor) >= 1e-6) return null;
  return minor;
}

function itemRef(item, fallbackIndex) {
  return {
    itemIndex: Number.isInteger(item.itemIndex) ? item.itemIndex : fallbackIndex,
    cx: String(item.cx ?? ""),
    name: String(item.name ?? ""),
  };
}

function addBlocked(blockedItems, item, fallbackIndex, reason, liveName = "") {
  blockedItems.push({
    ...itemRef(item, fallbackIndex),
    name: String(liveName || item.name || ""),
    reason,
  });
}

function exactMatches(rows, cx) {
  const prefix = `${String(cx)}_`;
  return rows.filter((row) => String(row.A ?? "").startsWith(prefix));
}

/**
 * Offline reference for the proposed Make Code module. Rows are normalized to
 * {A,D,E,F,G,H,I}; this file never calls Sheets, Make, LINE, or a webhook.
 *
 * Price semantics are deliberately split:
 * - declaredTotalMinor: E total for both LIFF clients (the only price exposed).
 * - capTotalMinor: E for branch, D for warehouse.
 * This resolves R3 without exposing D to either HTML.
 */
function runPreflight({ payload, rows, route }) {
  if (!payload || !Array.isArray(payload.items) || !Array.isArray(rows)) {
    throw new Error("preflight_input_invalid");
  }
  if (!Object.hasOwn(CAP_MINOR, route)) throw new Error("preflight_route_invalid");

  const blockedItems = [];
  const snapshot = [];

  payload.items.forEach((item, fallbackIndex) => {
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      addBlocked(blockedItems, item, fallbackIndex, "bad_qty");
    }

    const matches = exactMatches(rows, item.cx);
    if (matches.length === 0) {
      addBlocked(blockedItems, item, fallbackIndex, "no_match");
      return;
    }
    if (matches.length > 1) {
      addBlocked(blockedItems, item, fallbackIndex, "multi_row", matches[0].A);
      return;
    }

    const row = matches[0];
    const dMinor = moneyMinor(row.D);
    const eMinor = moneyMinor(row.E);
    const requiredPricesValid = route === "branch" ? eMinor !== null : dMinor !== null && eMinor !== null;
    if (!requiredPricesValid) addBlocked(blockedItems, item, fallbackIndex, "bad_price", row.A);

    const destinationId = String(route === "branch" ? row.G ?? "" : row.I ?? "");
    if (!DEST_RE.test(destinationId)) addBlocked(blockedItems, item, fallbackIndex, "empty_dest", row.A);

    snapshot.push({
      itemIndex: Number.isInteger(item.itemIndex) ? item.itemIndex : fallbackIndex,
      cx: String(item.cx),
      name: String(row.A),
      cOriginal: row.C,
      qty,
      dOriginal: row.D,
      dMinor,
      eOriginal: row.E,
      eMinor,
      vendor: String(row.F ?? ""),
      destinationId,
      hOriginal: row.H,
    });
  });

  if (blockedItems.length > 0) {
    const blockedText = blockedItems
      .map((b) => `第${b.itemIndex + 1}行 ${b.cx} ${b.name}：${b.reason}`)
      .join("\n");
    return {
      status: "held",
      orderId: payload.orderId,
      blockedItems,
      blockedItemsJson: JSON.stringify(blockedItems),
      blockedText,
    };
  }

  const declaredTotalMinor = snapshot.reduce((sum, item) => sum + item.eMinor * item.qty, 0);
  const capTotalMinor = snapshot.reduce(
    (sum, item) => sum + (route === "branch" ? item.eMinor : item.dMinor) * item.qty,
    0,
  );
  const isV5 = payload.clientVersion === "liff-v5";

  if (isV5 && capTotalMinor > CAP_MINOR[route]) {
    return {
      status: "over_cap",
      orderId: payload.orderId,
      capMinor: CAP_MINOR[route],
    };
  }
  if (isV5 && declaredTotalMinor !== Number(payload.totalDeclaredMinor)) {
    return {
      status: "stale_price",
      orderId: payload.orderId,
      serverTotalMinor: declaredTotalMinor,
      declaredTotalMinor: Number(payload.totalDeclaredMinor),
    };
  }

  return {
    status: "pass",
    orderId: payload.orderId,
    declaredTotalMinor,
    capTotalMinor,
    snapshot,
  };
}
// CXUAN_PREFLIGHT_CORE_END

const { payload, rows, route } = input;
return runPreflight({ payload, rows, route });
