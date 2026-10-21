import { z } from "zod";

export const checkoutLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutAddressSchema = z.object({
  line1: z.string().trim().min(5).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postcode: z.string().trim().max(20).optional().default(""),
  landmark: z.string().trim().max(120).optional().default(""),
});

export const checkoutPayloadSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(20),
  customerEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  customerNote: z.string().trim().max(500).optional().default(""),
  shippingZoneId: z.string().uuid(),
  confirmCod: z.literal(true),
  address: checkoutAddressSchema,
  lines: z.array(checkoutLineSchema).min(1).max(20),
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
