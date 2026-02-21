"use client";

import { useEffect, useState } from "react";

type Crowd = "空" | "普通" | "混";

type Post = {
  id: string;
  note: string;
  crowd: Crowd;
  createdAt: number;
};

type PlaceCard = {
  placeKey: string;
  placeText: string;
  posts: Post[];
};

const STORAGE_KEY = "queuewatch.cards.v1";
const EXPIRE_MS = 3 * 60 * 60 * 1000;

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function QueuePage() {
  const [cards, setCards] = useState<PlaceCard[]>([]);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [crowd, setCrowd] = useState<Crowd>("普通");

  function prune(list: PlaceCard[]) {
    const now = Date.now();
    return list
      .map((card) => ({
        ...card,
        posts: card.posts.filter((p) => now - p.createdAt < EXPIRE_MS),
      }))
      .filter((card) => card.posts.length > 0);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PlaceCard[];
      setCards(prune(parsed));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCards((prev) => {
        const next = prune(prev);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  function submit() {
    if (!place.trim()) return;

    const key = normalize(place);
    const newPost: Post = { id: uuid(), note, crowd, createdAt: Date.now() };

    setCards((prev) => {
      const next = [...prev];
      const existing = next.find((c) => c.placeKey === key);

      if (existing) {
        existing.posts.unshift(newPost);
      } else {
        next.unshift({ placeKey: key, placeText: place, posts: [newPost] });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setNote("");
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-1 text-lg font-semibold text-teal-600">行列ウォッチ</h1>
        <p className="mb-4 text-sm text-zinc-500">投稿は3時間で消えます</p>

        <div className="mb-4 space-y-2">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="場所"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />

          <input
            className="w-full rounded border px-3 py-2"
            placeholder="メモ（任意）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="flex gap-2">
            {(["空", "普通", "混"] as Crowd[]).map((c) => (
              <button
                key={c}
                onClick={() => setCrowd(c)}
                className={`flex-1 rounded border py-2 ${
                  crowd === c ? "bg-teal-500 text-white" : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <button onClick={submit} className="w-full rounded bg-teal-600 py-2 text-white">
            投稿
          </button>
        </div>

        <div className="space-y-4">
          {cards.map((card) => (
            <div key={card.placeKey} className="rounded border bg-white p-3">
              <div className="font-medium">{card.placeText}</div>
              {card.posts.map((p) => (
                <div key={p.id} className="text-sm text-zinc-600">
                  {p.crowd} {p.note}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
