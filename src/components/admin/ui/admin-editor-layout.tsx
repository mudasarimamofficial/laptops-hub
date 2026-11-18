import type { ReactNode } from "react";

type Props = {
  main: ReactNode;
  aside: ReactNode;
};

/**
 * Two-column object editor (desktop): primary writing column + contextual aside.
 * Stacks on tablet/phone. Matches Shopify blog/product editor grammar without copying assets.
 */
export function AdminEditorLayout({ main, aside }: Props) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] xl:items-start xl:gap-5">
      <div className="min-w-0 space-y-4">{main}</div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-[calc(var(--adm-topbar-h)+1rem)]">{aside}</aside>
    </div>
  );
}
