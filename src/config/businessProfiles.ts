import type { BusinessType } from '../types';

export interface BusinessProfile {
  type: BusinessType;
  label: string;
  defaultPresumptiveSection: string;
  presumptiveRate: number;
  typicalExpenseCategories: string[];
  description: string;
}

export const BUSINESS_PROFILES: BusinessProfile[] = [
  {
    type: 'business',
    label: 'Business',
    defaultPresumptiveSection: '44AD',
    presumptiveRate: 8,
    typicalExpenseCategories: ['Purchases', 'Salaries & Wages', 'Rent', 'Utilities', 'Travel', 'Repairs', 'Office Expenses', 'Professional Fees', 'Bank Charges', 'Miscellaneous'],
    description: 'Trading, manufacturing or any other business (Presumptive under 44AD @8%)'
  },
  {
    type: 'professional',
    label: 'Professional',
    defaultPresumptiveSection: '44ADA',
    presumptiveRate: 50,
    typicalExpenseCategories: ['Salaries & Wages', 'Office Rent', 'Utilities', 'Professional Development', 'Travel', 'Software & Subscriptions', 'Marketing', 'Printing & Stationery', 'Telephone & Internet', 'Miscellaneous'],
    description: 'Profession such as CA, Doctor, Engineer, Architect, Consultant (Presumptive under 44ADA @50%)'
  },
  {
    type: 'other',
    label: 'Business / Other',
    defaultPresumptiveSection: '44AD',
    presumptiveRate: 6,
    typicalExpenseCategories: ['Purchases', 'Salaries & Wages', 'Rent', 'Utilities', 'Travel', 'Repairs', 'Office Expenses', 'Professional Fees', 'Bank Charges', 'Miscellaneous'],
    description: 'Computation on actual / other business (6%-50% presumptive or book keeping)'
  }
];

export function getProfile(type: BusinessType): BusinessProfile {
  return BUSINESS_PROFILES.find((profile) => profile.type === type) ?? BUSINESS_PROFILES[0];
}