import type { SupabaseClient } from "@supabase/supabase-js";
import type { Booking, ChannelSource } from "@/lib/types";

export type SyncAlert = { kind: "new" | "changed" | "cancelled" | "restored"; booking: Booking; prev: Booking | null };
export type SyncResult = { total: number; alerts: SyncAlert[]; seeded: boolean; error?: string };

export function parseIcs(text: string): Record<string, string>[];
export function toReservations(events: Record<string, string>[], channel: string): {
  external_uid: string; summary: string; check_in: string; check_out: string; reservation_url: string | null; guest_phone_last4: string | null;
}[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function runSourceSync(db: SupabaseClient<any, any, any>, source: ChannelSource, fetchImpl?: typeof fetch): Promise<SyncResult>;
export function fmtRange(checkIn: string, checkOut: string): string;
export function formatEventMessage(ev: { kind: string; detail: { prev_check_in?: string; prev_check_out?: string } | null }, booking: Booking, listingName: string): { text: string; url: string | null };
