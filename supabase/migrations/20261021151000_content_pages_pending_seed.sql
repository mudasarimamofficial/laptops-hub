-- Seed information pages as pending — never auto-publish legal/business copy.
INSERT INTO public.content_pages (slug, title, body_html, status)
VALUES
  ('about', 'About Laptops HUB', '', 'pending'),
  ('why-laptops-hub', 'Why Laptops HUB', '', 'pending'),
  ('contact', 'Contact', '', 'pending'),
  ('faq', 'FAQ', '', 'pending'),
  ('shipping', 'Shipping & delivery', '', 'pending'),
  ('returns', 'Returns & refunds', '', 'pending'),
  ('warranty', 'Warranty', '', 'pending'),
  ('condition-guide', 'Condition guide', '', 'pending'),
  ('how-to-choose', 'How to choose a laptop', '', 'pending'),
  ('comparison-guide', 'Using comparison', '', 'pending'),
  ('order-inquiries', 'Order inquiries', '', 'pending'),
  ('privacy', 'Privacy policy', '', 'pending'),
  ('terms', 'Terms & conditions', '', 'pending')
ON CONFLICT (slug) DO NOTHING;
