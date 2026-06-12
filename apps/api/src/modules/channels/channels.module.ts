import { Module } from '@nestjs/common';

/**
 * Channels — adapter layer (docs/06 §1)। Sprint 0-তে খালি — ইচ্ছাকৃত।
 * Widget ও Messenger adapter পরের sprint (docs/14 §3)।
 * নিয়ম: adapter শুধু অনুবাদ করে (NormalizedMessage ⇄ channel format) —
 * business logic এখানে ঢুকবে না।
 */
@Module({})
export class ChannelsModule {}
