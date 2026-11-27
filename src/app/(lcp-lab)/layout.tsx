import "@/styles/v5.css";

/** Minimal layout for LCP isolation — no storefront header/footer/cart chrome. */
export default function LcpLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
