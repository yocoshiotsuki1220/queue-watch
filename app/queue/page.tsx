"use client";

import React, { useEffect, useMemo, useState } from "react";

/**
 * 行列ウォッチ（/queue 本体）
 * - localStorageのみ
 * - 通常投稿は3時間で消える（起動時 prune + タイマー prune）
 * - placeKeyで同一統合（ゆる正規化）
 * - カード一覧 / 最新順
 * - 投稿ごとに 👍カウント
 * - 各カードに「入力」フォーム（場所固定）
 * - 検索（場所名 + 投稿テキスト）
 * - 「自分メモ」だけは永久保存（別キーに蓄積）
 */

type Crowd = "1" | "2" | "3";

type Post = {
  id: string;
  note: string;
  crowd: Crowd;
  likes: number;
  createdAt: number;
};

type PlaceCard = {
  placeKey: string;
  placeText: string;
  posts: Post[]; // 新しい順
};

type MyMemo = {
  id: string;
  placeText: string;
  note: string;
  crowd: Crowd;
  createdAt: number;
};

const STORAGE_KEY = "queuewatch.cards.v2";
const STORAGE_KEY_ME = "queuewatch.me.v1";
const TTL_MS = 3 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function uid() {
  return (
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

// 超軽い正規化：空白寄せ / 小文字 / 記号ゆるめ
function normalizeBase(s: string) {
  return s
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toPlaceKey(placeText: string) {
  const base = normalizeBase(placeText);
  const light = base.replace(
    /[・•\-\–—_()（）【】\[\]{}<>『』「」"'\.,:;!?]/g,
    " "
  );
  return normalizeBase(light);
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function prune(cards: PlaceCard[]): PlaceCard[] {
  const cutoff = now() - TTL_MS;
  const out: PlaceCard[] = [];
  for (const c of cards) {
    const posts = (c.posts || []).filter((p) => p.createdAt >= cutoff);
    if (posts.length > 0) {
      out.push({
        ...c,
        posts: posts.sort((a, b) => b.createdAt - a.createdAt),
      });
    }
  }
  out.sort(
    (a, b) =>
      (b.posts?.[0]?.createdAt || 0) - (a.posts?.[0]?.createdAt || 0)
  );
  return out;
}

function loadCards(): PlaceCard[] {
  const raw = safeJsonParse<PlaceCard[]>(
    localStorage.getItem(STORAGE_KEY),
    []
  );
  return prune(raw);
}

function saveCards(cards: PlaceCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

// 自分メモだけ永久保存（上限500件。不要なら増やしてOK）
function saveMyMemo(placeText: string, note: string, crowd: Crowd) {
  const raw = safeJsonParse<MyMemo[]>(localStorage.getItem(STORAGE_KEY_ME), []);
  raw.unshift({
    id: uid(),
    placeText,
    note,
    crowd,
    createdAt: now(),
  });
  const trimmed = raw.slice(0, 500);
  localStorage.setItem(STORAGE_KEY_ME, JSON.stringify(trimmed));
}

function minutesAgo(ts: number) {
  const diff = Math.max(0, now() - ts);
  const m = Math.floor(diff / 60000);
  if (m <= 0) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

function crowdIcons(c: Crowd) {
  if (c === "1") return "👥";
  if (c === "2") return "👥👥";
  return "👥👥👥";
}

const COLORS = {
  bg: "#f5f5f5",
  card: "#ffffff",
  border: "#e6e6e6",
  text: "#111111",
  sub: "#6b7280",
  btn: "#0A0A0C", // 黒
  btn2: "#6b7280", // グレー（上の入力）
  chipActive: "#111111",
};

function inputStyle(): React.CSSProperties {
  return {
    height: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: `1px solid ${COLORS.border}`,
    outline: "none",
    fontSize: 14,
    background: "white",
    width: "100%",
    boxSizing: "border-box",
  };
}

function smallInputStyle(): React.CSSProperties {
  return {
    height: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    outline: "none",
    fontSize: 13,
    background: "white",
    width: "100%",
    boxSizing: "border-box",
  };
}

function CrowdPicker(props: { crowd: Crowd; setCrowd: (c: Crowd) => void }) {
  const items: { id: Crowd; label: string }[] = [
    { id: "1", label: "👥" },
    { id: "2", label: "👥👥" },
    { id: "3", label: "👥👥👥" },
  ];

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {items.map((it) => {
        const active = props.crowd === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => props.setCrowd(it.id)}
            style={{
              height: 34,
              minWidth: 54,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: active ? COLORS.chipActive : "white",
              color: active ? "white" : COLORS.text,
              fontWeight: 900,
              cursor: "pointer",
              letterSpacing: 1,
            }}
            aria-pressed={active}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function CardInlineForm(props: {
  placeText: string;
  onPost: (note: string, crowd: Crowd) => void;
}) {
  const [note, setNote] = useState("");
  const [crowd, setCrowd] = useState<Crowd>("2");
  const [preset, setPreset] = useState("自分メモ");

  return (
    <div style={{ padding: 12, background: "white" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          style={{
            height: 34,
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            padding: "0 10px",
            background: "white",
            fontWeight: 800,
          }}
          title="メモ種別"
        >
          <option>自分メモ</option>
          <option>現地かも</option>
          <option>見えた</option>
          <option>未確認</option>
        </select>

        <div
          style={{
            fontSize: 12,
            color: COLORS.sub,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "60%",
          }}
          title={props.placeText}
        >
          {props.placeText}
        </div>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ひとこと（任意）"
        style={inputStyle()}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 10,
        }}
      >
        <CrowdPicker crowd={crowd} setCrowd={setCrowd} />

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => {
            const text = note.trim();
            const finalNote =
              preset === "自分メモ"
                ? text
                : text
                ? `${preset}：${text}`
                : preset;

            // 表（3時間TTL）
            props.onPost(finalNote, crowd);

            // 裏（永久保存）は「自分メモ」だけ
            if (preset === "自分メモ") {
              saveMyMemo(props.placeText, finalNote, crowd);
            }

            setNote("");
          }}
          style={{
            height: 40,
            padding: "0 22px",
            borderRadius: 12,
            border: "none",
            background: COLORS.btn,
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          入力
        </button>
      </div>
    </div>
  );
}

function matchesQuery(card: PlaceCard, qNorm: string) {
  if (!qNorm) return true;

  const place = normalizeBase(card.placeText || "");
  if (place.includes(qNorm)) return true;

  for (const p of card.posts || []) {
    const note = normalizeBase(p.note || "");
    if (note.includes(qNorm)) return true;
  }
  return false;
}

export default function QueuePage() {
  // 上部フォーム
  const [placeText, setPlaceText] = useState("");
  const [note, setNote] = useState("");
  const [crowd, setCrowd] = useState<Crowd>("2");

  // 検索
  const [query, setQuery] = useState("");

  // カード一覧
  const [cards, setCards] = useState<PlaceCard[]>([]);

  useEffect(() => {
    const loaded = loadCards();
    setCards(loaded);

    const t = setInterval(() => {
      setCards((prev) => {
        const pruned = prune(prev);

        // サイズ比較
        if (pruned.length !== prev.length) {
          saveCards(pruned);
          return pruned;
        }

        // 先頭投稿時刻比較（重い stringify を避ける）
        const a0 = pruned[0]?.posts?.[0]?.createdAt || 0;
        const b0 = prev[0]?.posts?.[0]?.createdAt || 0;
        if (a0 !== b0) {
          saveCards(pruned);
          return pruned;
        }

        return prev;
      });
    }, 30 * 1000);

    return () => clearInterval(t);
  }, []);

  const sortedCards = useMemo(() => {
    return [...cards].sort(
      (a, b) =>
        (b.posts?.[0]?.createdAt || 0) - (a.posts?.[0]?.createdAt || 0)
    );
  }, [cards]);

  const filteredCards = useMemo(() => {
    const qNorm = normalizeBase(query);
    return sortedCards.filter((c) => matchesQuery(c, qNorm));
  }, [sortedCards, query]);

  function addPost(
    targetPlaceText: string,
    targetNote: string,
    targetCrowd: Crowd
  ) {
    const text = (targetPlaceText ?? "").trim();
    if (!text) return;

    const key = toPlaceKey(text);

    const p: Post = {
      id: uid(),
      note: (targetNote ?? "").trim(),
      crowd: targetCrowd,
      likes: 0,
      createdAt: now(),
    };

    setCards((prev) => {
      const next = prune(prev);
      const idx = next.findIndex((c) => c.placeKey === key);

      let merged: PlaceCard[];
      if (idx >= 0) {
        const updated: PlaceCard = {
          ...next[idx],
          placeText: text,
          posts: [p, ...(next[idx].posts || [])].sort(
            (a, b) => b.createdAt - a.createdAt
          ),
        };
        merged = [...next.slice(0, idx), updated, ...next.slice(idx + 1)];
      } else {
        const created: PlaceCard = {
          placeKey: key,
          placeText: text,
          posts: [p],
        };
        merged = [created, ...next];
      }

      merged.sort(
        (a, b) =>
          (b.posts?.[0]?.createdAt || 0) - (a.posts?.[0]?.createdAt || 0)
      );
      saveCards(merged);
      return merged;
    });
  }

  function like(placeKey: string, postId: string) {
    setCards((prev) => {
      const next = prune(prev).map((c) => {
        if (c.placeKey !== placeKey) return c;
        return {
          ...c,
          posts: (c.posts || []).map((p) =>
            p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p
          ),
        };
      });
      saveCards(next);
      return next;
    });
  }

  return (
    <main
      style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: 18 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 22 }}>行列ウォッチ</div>
        </div>
        <div style={{ fontSize: 12, color: COLORS.sub, marginBottom: 12 }}>
          投稿は3時間で消えます
        </div>

        {/* Top Form */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              placeholder="場所（例：渋谷 / shibuya / 東北沢 千里眼）"
              style={inputStyle()}
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ひとこと（任意）"
              style={inputStyle()}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CrowdPicker crowd={crowd} setCrowd={setCrowd} />

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={() => {
                  addPost(placeText, note, crowd);
                  setNote("");
                }}
                style={{
                  height: 42,
                  padding: "0 22px",
                  borderRadius: 12,
                  border: "none",
                  background: COLORS.btn2,
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                入力
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>カード一覧</div>
              <div style={{ fontSize: 12, color: COLORS.sub }}>最新順</div>
            </div>

            {/* Search */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="検索（場所 / ひとこと）"
                style={smallInputStyle()}
              />
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  style={{
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                    background: "white",
                    color: COLORS.sub,
                    fontWeight: 900,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  クリア
                </button>
              ) : null}
            </div>
          </div>

          <div
            style={{
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {filteredCards.length === 0 ? (
              <div
                style={{
                  color: COLORS.sub,
                  fontSize: 13,
                  padding: 12,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                }}
              >
                {query.trim()
                  ? "検索に一致する投稿がありません。"
                  : "いまのところ、行列の投稿はありません。"}
              </div>
            ) : (
              filteredCards.map((c) => (
                <div
                  key={c.placeKey}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{c.placeText}</div>
                    <div style={{ color: COLORS.sub, fontSize: 12 }}>
                      ({c.posts?.length || 0})
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${COLORS.border}` }} />

                  {/* Posts */}
                  <div
                    style={{
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {(c.posts || []).slice(0, 8).map((p) => (
                      <div
                        key={p.id}
                        style={{
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={p.note || ""}
                          >
                            {p.note ? p.note : "（ひとことなし）"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: COLORS.sub,
                              marginTop: 2,
                            }}
                          >
                            {minutesAgo(p.createdAt)}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => like(c.placeKey, p.id)}
                            style={{
                              height: 30,
                              padding: "0 10px",
                              borderRadius: 10,
                              border: `1px solid ${COLORS.border}`,
                              background: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontWeight: 800,
                            }}
                            title="いいね"
                          >
                            <span>👍</span>
                            <span style={{ minWidth: 10, textAlign: "right" }}>
                              {p.likes || 0}
                            </span>
                          </button>

                          <div
                            style={{
                              height: 30,
                              minWidth: 58,
                              padding: "0 10px",
                              borderRadius: 10,
                              border: `1px solid ${COLORS.border}`,
                              background: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              letterSpacing: 1,
                            }}
                            title="混雑"
                          >
                            {crowdIcons(p.crowd)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline input */}
                  <div style={{ borderTop: `1px solid ${COLORS.border}` }} />
                  <CardInlineForm
                    placeText={c.placeText}
                    onPost={(n, cr) => addPost(c.placeText, n, cr)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
