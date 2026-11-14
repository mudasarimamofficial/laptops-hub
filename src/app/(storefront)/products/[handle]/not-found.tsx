import { NotFoundView } from "@/components/storefront/v5/not-found-view";

export default function ProductNotFound() {
  return <NotFoundView title="This product isn’t in the catalog" msg="The link may point to a product that is no longer listed." />;
}
