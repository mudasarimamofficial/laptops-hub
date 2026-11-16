import type { EmailMessage } from "@/lib/notify/templates";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  editor: "Editor",
  fulfillment: "Fulfillment",
};

/** Plain-text invitation. The link signs the person in once and opens "Set a new password". */
export function staffInviteEmail(role: string, link: string, invitedBy: string | null): EmailMessage {
  return {
    subject: "Your Laptops HUB admin access",
    text: [
      `You have been given ${ROLE_LABEL[role] ?? role} access to the Laptops HUB admin${invitedBy ? ` by ${invitedBy}` : ""}.`,
      "",
      "Open this link to choose your password (it works once and expires within 24 hours):",
      link,
      "",
      "After setting your password, sign in at the admin login page with this email address.",
      "If you did not expect this email, ignore it — no account access is possible without the link.",
    ].join("\n"),
  };
}
