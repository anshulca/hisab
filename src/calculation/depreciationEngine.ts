import type { DepreciationAsset, DepreciationSummary } from '../types';

export interface DepreciationBlock {
  blockName: string;
  rate: number;
  openingWdv: number;
  additions: number;
  sales: number;
}

const DEFAULT_BLOCKS: DepreciationBlock[] = [
  { blockName: 'Plant & Machinery', rate: 0.15, openingWdv: 0, additions: 0, sales: 0 },
  { blockName: 'Furniture & Fittings', rate: 0.1, openingWdv: 0, additions: 0, sales: 0 },
  { blockName: 'Computers & Software', rate: 0.4, openingWdv: 0, additions: 0, sales: 0 },
  { blockName: 'Buildings', rate: 0.1, openingWdv: 0, additions: 0, sales: 0 },
  { blockName: 'Vehicles', rate: 0.15, openingWdv: 0, additions: 0, sales: 0 }
];

export function computeDepreciation(blocks: DepreciationBlock[], halfYearForNew?: boolean): DepreciationSummary {
  const assets: DepreciationAsset[] = blocks.map((block, index) => {
    const closingWdv = block.openingWdv + block.additions - block.sales;
    const effectiveRate = halfYearForNew && block.additions > 0 ? block.rate / 2 : block.rate;
    const depreciation = Math.round(Math.max(0, closingWdv) * effectiveRate);
    return {
      id: `asset-${index + 1}`,
      blockName: block.blockName,
      rate: block.rate,
      openingWdv: block.openingWdv,
      additions: block.additions,
      sales: block.sales,
      closingWdv: Math.max(0, closingWdv - depreciation),
      depreciation
    };
  });

  const totalDepreciation = assets.reduce((sum, a) => sum + a.depreciation, 0);
  return { totalDepreciation, assets };
}

export function getDefaultDepreciationBlocks(): DepreciationBlock[] {
  return DEFAULT_BLOCKS.map((b) => ({ ...b }));
}

export function createAssetId(): string {
  return `asset-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}