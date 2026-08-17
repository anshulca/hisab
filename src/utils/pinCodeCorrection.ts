export interface PinCodeInfo {
  pincode: string;
  city: string;
  state: string;
  circle: string;
  ward: string;
  office: string;
}

const PIN_CODE_DB: PinCodeInfo[] = [
  { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', circle: 'Mumbai', ward: 'Zone 1', office: 'Mumbai GPO' },
  { pincode: '110001', city: 'Delhi', state: 'Delhi', circle: 'Delhi', ward: 'Central Delhi', office: 'New Delhi GPO' },
  { pincode: '560001', city: 'Bengaluru', state: 'Karnataka', circle: 'Bengaluru', ward: 'Bangalore North', office: 'Bangalore GPO' },
  { pincode: '411001', city: 'Pune', state: 'Maharashtra', circle: 'Pune', ward: 'Pune City', office: 'Pune GPO' },
  { pincode: '700001', city: 'Kolkata', state: 'West Bengal', circle: 'Kolkata', ward: 'Kolkata North', office: 'Kolkata GPO' },
  { pincode: '500001', city: 'Hyderabad', state: 'Telangana', circle: 'Hyderabad', ward: 'Hyderabad City', office: 'Hyderabad GPO' },
  { pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', circle: 'Chennai', ward: 'Chennai City', office: 'Chennai GPO' },
  { pincode: '380001', city: 'Ahmedabad', state: 'Gujarat', circle: 'Ahmedabad', ward: 'Ahmedabad City', office: 'Ahmedabad GPO' },
  { pincode: '452001', city: 'Indore', state: 'Madhya Pradesh', circle: 'Indore', ward: 'Indore City', office: 'Indore GPO' },
  { pincode: '302001', city: 'Jaipur', state: 'Rajasthan', circle: 'Jaipur', ward: 'Jaipur City', office: 'Jaipur GPO' },
  { pincode: '201301', city: 'Noida', state: 'Uttar Pradesh', circle: 'Noida', ward: 'Gautam Buddha Nagar', office: 'Noida Sector 17' },
  { pincode: '122001', city: 'Gurugram', state: 'Haryana', circle: 'Gurugram', ward: 'Gurugram City', office: 'Gurugram HO' },
  { pincode: '400013', city: 'Mumbai', state: 'Maharashtra', circle: 'Mumbai', ward: 'Zone 3', office: 'Mumbai Central' },
  { pincode: '400070', city: 'Mumbai', state: 'Maharashtra', circle: 'Mumbai', ward: 'Zone 3', office: 'Andheri East' },
  { pincode: '110016', city: 'Delhi', state: 'Delhi', circle: 'Delhi', ward: 'South Delhi', office: 'Hauz Khas' },
  { pincode: '110025', city: 'Delhi', state: 'Delhi', circle: 'Delhi', ward: 'South Delhi', office: 'Defence Colony' }
];

const DEFAULT_INFO: PinCodeInfo = {
  pincode: '',
  city: 'India',
  state: '',
  circle: '',
  ward: '',
  office: ''
};

export function lookupPinCode(pinCode: string | undefined): PinCodeInfo {
  if (!pinCode) return { ...DEFAULT_INFO };
  const cleaned = pinCode.trim();
  const found = PIN_CODE_DB.find((entry) => entry.pincode === cleaned);
  if (found) return found;

  const loose = PIN_CODE_DB.find((entry) => entry.pincode.startsWith(cleaned.slice(0, 3)) && cleaned.length >= 3);
  if (loose) {
    return {
      ...loose,
      pincode: cleaned,
      office: 'Inferred from PIN prefix'
    };
  }
  return { ...DEFAULT_INFO, pincode: cleaned };
}

export function correctPinCodeValue(pinCode: string | undefined): string {
  if (!pinCode) return '';
  return pinCode.replace(/\D/g, '').slice(0, 6);
}

export function getStateByPin(pinCode: string | undefined): string {
  if (!pinCode) return '';
  const clean = pinCode.replace(/\D/g, '');
  if (clean.length < 3) return '';
  const firstDigit = Number(clean[0]);
  const map: Record<number, string> = {
    1: ['Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh', 'Jammu & Kashmir', 'Chandigarh'][0],
    2: ['Uttar Pradesh', 'Uttarakhand'][0],
    3: ['Rajasthan', 'Gujarat'][0],
    4: ['Maharashtra', 'Goa', 'Madhya Pradesh', 'Chhattisgarh'][0],
    5: ['Telangana', 'Andhra Pradesh', 'Karnataka'][0],
    6: ['Tamil Nadu', 'Kerala', 'Puducherry'][0],
    7: ['West Bengal', 'Odisha', 'Assam', 'Bihar', 'Jharkhand'][0],
    8: ['Bihar', 'Jharkhand', 'West Bengal', 'North-East'][0]
  };
  return map[firstDigit] || '';
}