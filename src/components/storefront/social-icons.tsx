/** Lightweight inline SVGs for social + contact rows (no icon pack). */

type IconProps = { size?: number; className?: string; title?: string };

export function IconFacebook({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 8.5V6.8c0-.7.1-1.1 1.1-1.1H16.5V3h-2.3C11.5 3 10.4 4.5 10.4 6.6v1.9H8.5V11h1.9v10h3.6V11H16l.4-2.5H14z" />
    </svg>
  );
}

export function IconInstagram({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTikTok({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 4.2c.7 1.7 2.1 2.9 3.9 3.2v2.5c-1.5-.1-2.9-.6-4-1.4v6.3c0 3.2-2.6 5.8-5.8 5.8S4.9 17.9 4.9 14.7s2.6-5.8 5.8-5.8c.3 0 .6 0 .9.1v2.6a3.2 3.2 0 00-.9-.1 3.2 3.2 0 100 6.4 3.2 3.2 0 003.2-3.2V4.2h2.7z" />
    </svg>
  );
}

export function IconYouTube({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2a2.7 2.7 0 00-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3A2.7 2.7 0 002.4 7.2 28 28 0 002 12a28 28 0 00.4 4.8 2.7 2.7 0 001.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 001.9-1.9A28 28 0 0022 12a28 28 0 00-.4-4.8zM10 15.2V8.8L15.5 12 10 15.2z" />
    </svg>
  );
}

export function IconWhatsApp({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.1A9.9 9.9 0 002.8 16.4L2 22l5.8-.8A9.9 9.9 0 1012 2.1zm5.5 14.1c-.2.7-1.2 1.2-1.9 1.4-.5.1-1.1.2-3.6-.8-3.1-1.3-5.1-4.5-5.3-4.7-.2-.2-1.5-2-1.5-3.8s1-2.7 1.3-3.1c.3-.3.7-.4 1-.4h.7c.2 0 .5 0 .7.5l1 2.4c.1.3 0 .5-.1.7l-.5.7c-.2.2-.3.4-.1.7.2.4.8 1.4 1.8 2.2 1.2 1.1 2.2 1.4 2.6 1.6.3.1.6.1.8-.1l1-.9c.2-.2.5-.2.7-.1l2.2 1c.3.1.5.2.5.4.1.4-.1 1.4-.3 2.1z" />
    </svg>
  );
}

export function IconPin({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

export function IconPhone({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 3.8h3.2l1.4 4.2-2 1.2a12 12 0 005.7 5.7l1.2-2 4.2 1.4v3.2a2 2 0 01-2.2 2A15.5 15.5 0 014.5 6a2 2 0 012-2.2z" />
    </svg>
  );
}

export function IconMail({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

export function socialIcon(id: string) {
  switch (id) {
    case "facebook":
      return <IconFacebook />;
    case "instagram":
      return <IconInstagram />;
    case "tiktok":
      return <IconTikTok />;
    case "youtube":
      return <IconYouTube />;
    default:
      return null;
  }
}
