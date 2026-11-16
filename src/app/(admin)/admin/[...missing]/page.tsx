import { notFound } from "next/navigation";

// Unmatched /admin/* URLs render the admin 404 (admin/not-found.tsx) inside the admin shell, never storefront chrome.
export default function MissingAdminRoute() {
  notFound();
}
