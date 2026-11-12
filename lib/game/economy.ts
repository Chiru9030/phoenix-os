export interface RewardTier { label: string; goldCost: number }
/** Default real-life reward ladder from the product spec. Players can add their own. */
export const DEFAULT_REWARD_TIERS: RewardTier[] = [
  { label: 'Watch a movie', goldCost: 500 }, { label: 'Buy a game', goldCost: 1000 }, { label: 'New shoes', goldCost: 3000 }, { label: 'Weekend trip', goldCost: 5000 },
];
/** Discounts are additive and capped at 50% so a maxed build can never redeem for free. */
export const discountedCost = (base: number, discountPct: number) => Math.max(1, Math.round(base * (1 - Math.min(50, Math.max(0, discountPct)) / 100)));
