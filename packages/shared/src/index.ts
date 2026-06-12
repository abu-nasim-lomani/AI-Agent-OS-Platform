/**
 * @agentos/shared — cross-app types ও plan config।
 * Frontend, Core API, Widget — সবাই এক সংজ্ঞা ব্যবহার করবে।
 */

// ── Normalized Message Model (docs/06 §1) ───────────────────────────
// Adapter-রা channel format ⇄ এই রূপে অনুবাদ করে; Core কখনো channel-specific কিছু দেখে না।

export type ChannelType = 'playground' | 'widget' | 'messenger'; // Phase 0 সেট

export type MessageContent =
  | { type: 'text'; body: string }
  | { type: 'unsupported'; note: string }; // F7.4: ছবি/voice → ভদ্র fallback

export interface NormalizedMessage {
  conversationId: string;
  endUserId: string;
  direction: 'in' | 'out';
  content: MessageContent;
  channel: {
    type: ChannelType;
    channelMessageId?: string;
    capabilities: { buttons: boolean; media: boolean; typing: boolean };
  };
}

export interface AnswerCitation {
  sourceName: string;
  page: number | null;
}

// ── Plans (docs/10 §2 — Plan Lock v1.0 অনুমোদিত সংখ্যা) ─────────────
// Cap enforcement (F10.2) এই config থেকেই পড়বে — সংখ্যা কোথাও hard-code নয়।

export type PlanId = 'trial' | 'starter' | 'growth' | 'business' | 'enterprise';
export type ModelProfile = 'economy' | 'standard' | 'premium';

export interface PlanLimits {
  agents: number;
  monthlyAiReplies: number;
  storageMb: number;
  allowedProfiles: ModelProfile[];
  brandingRemovable: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  trial: {
    agents: 1,
    monthlyAiReplies: 200,
    storageMb: 20,
    allowedProfiles: ['economy'],
    brandingRemovable: false,
  },
  starter: {
    agents: 1,
    monthlyAiReplies: 1_000,
    storageMb: 100,
    allowedProfiles: ['economy'],
    brandingRemovable: false,
  },
  growth: {
    agents: 5,
    monthlyAiReplies: 4_000,
    storageMb: 500,
    allowedProfiles: ['economy'],
    brandingRemovable: true,
  },
  business: {
    agents: 20,
    monthlyAiReplies: 12_000,
    storageMb: 2_048,
    allowedProfiles: ['economy', 'standard'],
    brandingRemovable: true,
  },
  enterprise: {
    agents: Number.MAX_SAFE_INTEGER,
    monthlyAiReplies: Number.MAX_SAFE_INTEGER, // contract-এ নির্ধারিত
    storageMb: Number.MAX_SAFE_INTEGER,
    allowedProfiles: ['economy', 'standard', 'premium'],
    brandingRemovable: true,
  },
};
