import { z } from "zod";

export const organizationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  taxId: z.string().trim().max(32).optional(),
  email: z.string().email().optional(),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(200),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("es-AR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    })
    .default("America/Argentina/Buenos_Aires"),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .toUpperCase()
    .default("ARS"),
});

export type OrganizationInput = z.infer<typeof organizationInputSchema>;
