import { useCallback, useEffect, useState } from "react";

const KEY = "dashboard:v1";

interface Marks {
  read: string[];
  saved: string[];
  // Feed URLs of favourite sources.
  favourites: string[];
}

function load(): Marks {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Marks>;
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { read: strings(parsed.read), saved: strings(parsed.saved), favourites: strings(parsed.favourites) };
  } catch {
    return { read: [], saved: [], favourites: [] };
  }
}

/** Read, saved and favourite-source marks, kept in this browser only. */
export function useMarks(knownUrls: Set<string> | null) {
  const [marks, setMarks] = useState<Marks>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(marks));
    } catch {
      // Storage full or blocked: marks just won't persist.
    }
  }, [marks]);

  // Forget read marks for articles that have aged out; saved ones stay.
  useEffect(() => {
    if (!knownUrls) return;
    setMarks((m) => ({ ...m, read: m.read.filter((u) => knownUrls.has(u)) }));
  }, [knownUrls]);

  const toggle = useCallback((list: keyof Marks, url: string, on?: boolean) => {
    setMarks((m) => {
      const has = m[list].includes(url);
      const want = on ?? !has;
      if (want === has) return m;
      return { ...m, [list]: want ? [...m[list], url] : m[list].filter((u) => u !== url) };
    });
  }, []);

  return {
    read: new Set(marks.read),
    saved: new Set(marks.saved),
    setRead: (url: string, on?: boolean) => toggle("read", url, on),
    toggleSaved: (url: string) => toggle("saved", url),
    favourites: new Set(marks.favourites),
    toggleFavourite: (source: string) => toggle("favourites", source),
  };
}
