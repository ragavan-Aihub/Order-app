export const ADDRESS_LABELS = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
] as const;

export type AddressLabel = (typeof ADDRESS_LABELS)[number]['value'];

export const ADDRESS_FIELD_COPY = {
  house: 'Flat / House No. / Building / Block No.',
  area: 'Area / Street / Village',
  landmark: 'Landmark (Optional)',
  pincode: 'Pincode',
  state: 'State',
  label: 'Add address label',
  receiver: 'Add receiver details',
  receiverName: "Receiver's Name",
  receiverPhone: "Receiver's Phone Number",
} as const;

const PIN_THREE_STATE: Record<string, string> = {
  '403': 'Goa',
  '737': 'Sikkim',
  '744': 'Andaman and Nicobar Islands',
  '790': 'Arunachal Pradesh',
  '791': 'Arunachal Pradesh',
  '792': 'Arunachal Pradesh',
  '793': 'Meghalaya',
  '794': 'Meghalaya',
  '795': 'Manipur',
  '796': 'Mizoram',
  '797': 'Nagaland',
  '798': 'Nagaland',
  '799': 'Tripura',
};

const PIN_TWO_STATE: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Punjab',
  '17': 'Himachal Pradesh',
  '18': 'Jammu and Kashmir',
  '19': 'Jammu and Kashmir',
  '20': 'Uttar Pradesh',
  '21': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh',
  '24': 'Uttar Pradesh',
  '25': 'Uttar Pradesh',
  '26': 'Uttar Pradesh',
  '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh',
  '30': 'Rajasthan',
  '31': 'Rajasthan',
  '32': 'Rajasthan',
  '33': 'Rajasthan',
  '34': 'Rajasthan',
  '36': 'Gujarat',
  '37': 'Gujarat',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '52': 'Andhra Pradesh',
  '53': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '63': 'Tamil Nadu',
  '64': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '69': 'Kerala',
  '70': 'West Bengal',
  '71': 'West Bengal',
  '72': 'West Bengal',
  '73': 'West Bengal',
  '74': 'West Bengal',
  '75': 'Odisha',
  '76': 'Odisha',
  '77': 'Odisha',
  '78': 'Assam',
  '80': 'Bihar',
  '81': 'Jharkhand',
  '82': 'Jharkhand',
  '83': 'Jharkhand',
  '84': 'Bihar',
  '85': 'Bihar',
};

export function isValidPincode(pincode: string) {
  return /^\d{6}$/.test(pincode.trim());
}

export function stateFromPincode(pincode: string) {
  const pin = pincode.trim();
  if (!isValidPincode(pin)) {
    return '';
  }
  return PIN_THREE_STATE[pin.slice(0, 3)] ?? PIN_TWO_STATE[pin.slice(0, 2)] ?? '';
}

export async function lookupPincodeState(pincode: string) {
  const fallback = stateFromPincode(pincode);
  if (!fallback && !isValidPincode(pincode)) {
    return '';
  }
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode.trim()}`);
    const payload = (await response.json()) as Array<{
      Status?: string;
      PostOffice?: Array<{ State?: string }>;
    }>;
    const state = payload?.[0]?.PostOffice?.[0]?.State?.trim();
    return state || fallback;
  } catch {
    return fallback;
  }
}

export function composeAddressLine(house: string, area: string, landmark: string, state = '') {
  return [house, area, landmark, state]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
    .join(', ');
}
