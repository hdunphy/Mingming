/** BarkShield stacks are a %maxHp float that decays 20% a turn, so round for display only (ticket 183a). */
export const displayStacks = (stacks: number): number => Math.round(stacks * 10) / 10;
