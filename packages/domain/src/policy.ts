import { isAddress } from "viem";
import { z } from "zod";
import { parseUsdc } from "./money.js";

const MIN_DURATION_SECONDS = 5 * 60;
const MAX_DURATION_SECONDS = 30 * 24 * 60 * 60;

const positiveUsdcAmount = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/, {
    message: "amountUsdc must be a positive decimal value with at most six decimals",
  })
  .refine(
    (value) => {
      try {
        return parseUsdc(value) > 0n;
      } catch {
        return false;
      }
    },
    { message: "amountUsdc must be greater than zero" },
  );

const evmAddress = z.string().refine(isAddress, { message: "must be a valid EVM address" });

export const policyIntentSchema = z.object({
  amountUsdc: positiveUsdcAmount,
  beneficiary: evmAddress,
  durationSeconds: z.number().int().min(MIN_DURATION_SECONDS).max(MAX_DURATION_SECONDS),
  maxLossBps: z.number().int().min(1).max(5_000),
  vault: evmAddress,
});

export type PolicyIntent = z.infer<typeof policyIntentSchema>;
