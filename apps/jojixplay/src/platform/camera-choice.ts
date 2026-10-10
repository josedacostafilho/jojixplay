const KEY = "jojixplay.lens";

/**
 * The lens the adult last chose, by the name the browser gives it. This is a device setting: it
 * says nothing about the picture or anyone in it. A browser that refuses storage simply forgets.
 */
export function rememberedLens(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberLens(label: string): void {
  try {
    localStorage.setItem(KEY, label);
  } catch {
    // Private windows and blocked site data: the choice lasts for this session only.
  }
}
