import { useEffect, useState } from 'react';

/**
 * Bir CSS medya sorgusunu React durumu olarak izler.
 *
 * Duyarlı yerleşimlerde iki varyantı da DOM'a basıp CSS ile gizlemek yerine
 * yalnızca geçerli olanı render etmek için kullanılır. Böylece ekran
 * okuyucular içeriği iki kez duyurmaz ve gereksiz düğüm oluşmaz.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Yığılmış (mobil) yerleşime geçiş noktası — features.css ile aynı sınır. */
export function useIsCompact() {
  return useMediaQuery('(max-width: 720px)');
}
