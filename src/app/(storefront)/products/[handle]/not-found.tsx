import { NotFoundView } from "@/components/storefront/v5/not-found-view";
import { getPublishedThemeGlobals } from "@/lib/content/published-homepage";

export default async function ProductNotFound() {
  const c = await getPublishedThemeGlobals();
  return <NotFoundView title={c.nfProductTitle} msg={c.nfProductText} buttonLabel={c.nfButton} buttonHref={c.nfButtonHref} />;
}
