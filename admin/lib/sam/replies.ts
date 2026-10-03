import { formatSizeChoices } from '@/lib/sam/match-products';
import { summarize } from '@/lib/sam/apply-draft';
import type { CatalogProduct, DraftViewLine, SamLanguage } from '@/lib/sam/types';

function rupee(amount: number) {
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

export const replies = {
  greet(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'வணக்கம்! எப்படி உதவட்டும்?';
    }
    if (lang === 'mix') {
      return 'Hi! Enna venum sollunga.';
    }
    return 'Hi! What can I help you with?';
  },
  aboutSam(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'நான் Farm2Flavours உதவியாளர். பொருள் சேர்க்கவும், கேள்வி கேட்கவும் முடியும்.';
    }
    if (lang === 'mix') {
      return 'Naan Farm2Flavours assistant. Products add panna, questions kekka help pannuven.';
    }
    return "I'm the Farm2Flavours assistant. I can help you add products and answer catalog questions.";
  },
  capabilities(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'ஊறுகாய் சேர்க்க, அளவு மாற்ற, விலை கேட்க, ஆர்டர் நிலை பார்க்க உதவலாம். Confirm என்றால் ஆர்டர் உறுதி.';
    }
    if (lang === 'mix') {
      return 'I can add pickles, change quantity, tell price, and check order status. Confirm nu sonna order confirm aagum.';
    }
    return 'I can add products, change quantities, share prices from the catalog, and check your last order. Say Confirm when you are ready to place.';
  },
  irrelevant(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'நான் Farm2Flavours ஆர்டருக்கு மட்டும் உதவுவேன். ஊறுகாய் சேர்க்க சொல்லுங்கள்.';
    }
    if (lang === 'mix') {
      return 'Naan Farm2Flavours orders-ku dhaan help pannuven. Pickle add pannunga.';
    }
    return "I can only help with Farm2Flavours products and orders. Try saying add two mango pickle.";
  },
  productList(lang: SamLanguage, names: string[]) {
    const shown = names.slice(0, 12).join(', ');
    if (!names.length) {
      return this.noInfo(lang);
    }
    if (lang === 'ta') {
      return `இப்போது உள்ளவை: ${shown}.`;
    }
    if (lang === 'mix') {
      return `Ippo irukkuradhu: ${shown}.`;
    }
    return `We have: ${shown}.`;
  },
  searchList(lang: SamLanguage, names: string[]) {
    if (!names.length) {
      return this.missing(lang);
    }
    return this.productList(lang, names);
  },
  availability(lang: SamLanguage, name: string, available: boolean) {
    if (available) {
      if (lang === 'ta') {
        return `${name} இப்போது கிடைக்கிறது.`;
      }
      if (lang === 'mix') {
        return `${name} ippo available.`;
      }
      return `${name} is available.`;
    }
    return this.unavailable(lang, name);
  },
  farmHelp(lang: SamLanguage) {
    return this.howToOrder(lang);
  },
  trySayingAdd(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'இப்படி சொல்லுங்கள்: add two mango pickle.';
    }
    if (lang === 'mix') {
      return 'Try: add two mango pickle nu sollunga.';
    }
    return 'Try saying add two mango pickle.';
  },
  missing(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'அந்த பொருள் கிடைக்கவில்லை. வேறு பெயர் சொல்லுங்களேன்?';
    }
    if (lang === 'mix') {
      return "I couldn't find that product. Innoru name try pannunga.";
    }
    return "I couldn't find that product. Could you try another product name?";
  },
  unavailable(lang: SamLanguage, name: string) {
    if (lang === 'ta') {
      return `${name} இப்போது கிடைக்கவில்லை.`;
    }
    return `${name} is not available right now.`;
  },
  ambiguous(lang: SamLanguage, products: CatalogProduct[]) {
    const sizes = formatSizeChoices(products);
    if (lang === 'ta') {
      return `எந்த அளவு வேண்டும்: ${sizes}?`;
    }
    return `Which size would you like: ${sizes}?`;
  },
  added(lang: SamLanguage, items: DraftViewLine[], total: number, askConfirm: boolean) {
    const list = summarize(items);
    const money = rupee(total);
    if (lang === 'ta') {
      return askConfirm
        ? `${list} சேர்த்தேன். மொத்தம் ${money}. உறுதி என்றால் Confirm என்று சொல்லுங்கள்.`
        : `${list} சேர்த்தேன். வேறு ஏதாவது வேண்டுமா?`;
    }
    if (lang === 'mix') {
      return askConfirm
        ? `I found ${list}. Total ${money}. Confirm nu sollunga, illana Change nu sollunga.`
        : `Added ${list}. Innum edhavadhu venuma?`;
    }
    return askConfirm
      ? `I found ${list}. Your total is ${money}. Please say Confirm to place the order, or say Change to modify it.`
      : `Added ${list}. Anything else?`;
  },
  updated(lang: SamLanguage, items: DraftViewLine[], total: number) {
    const list = summarize(items);
    const money = rupee(total);
    if (lang === 'ta') {
      return `சரி, ${list}. மொத்தம் ${money}. உறுதிப்படுத்த Confirm என்று சொல்லுங்கள்.`;
    }
    if (lang === 'mix') {
      return `Okay, ${list}. Total ${money}. Confirm nu sollunga.`;
    }
    return `Okay, ${list}. Your total is ${money}. Please say Confirm to place the order.`;
  },
  emptyDraft(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'காலியாக உள்ளது. என்ன சேர்க்கலாம்?';
    }
    return 'Your draft is empty. What would you like to add?';
  },
  cancelled(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'சரி, ஆர்டரை நிறுத்திவிட்டேன்.';
    }
    return "Okay, I've cancelled this draft.";
  },
  ingredients(lang: SamLanguage, name: string, text: string) {
    if (lang === 'ta') {
      return `${name} இல் ${text} உள்ளது.`;
    }
    return `${name} contains ${text}.`;
  },
  noIngredients(lang: SamLanguage, name: string) {
    if (lang === 'ta') {
      return `${name} சேர்மான விவரம் என்னிடம் இல்லை. தவறாக சொல்ல விரும்பவில்லை. Farm2Flavours அணிக்கு குறிப்பு வைக்கவா?`;
    }
    if (lang === 'mix') {
      return `I don't have ingredient info for ${name} yet, and I don't want to guess. Team-ku note pannaatta?`;
    }
    return `I don't have the ingredient information for ${name} yet, and I don't want to guess and give you the wrong information. Would you like me to note this request for the Farm2Flavours team?`;
  },
  noted(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'குறித்துவிட்டேன். தகவல் சேர்ந்ததும் இங்கே காட்டலாம்.';
    }
    return "Done. I've noted it for the Farm2Flavours team. Once the information is added, it can be shown here.";
  },
  needSignIn(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'ஆர்டர் செய்ய முதலில் கைபேசி எண்ணால் உள்நுழையவும்.';
    }
    return 'Please sign in with your mobile number to place the order.';
  },
  needAddress(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'டெலிவரி முகவரி இல்லை. முகவரியைச் சேர்த்து Confirm சொல்லுங்கள்.';
    }
    return 'Add a delivery address, then say Confirm to place the order.';
  },
  notConfirm(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'உறுதிப்படுத்த Confirm என்று தெளிவாகச் சொல்லுங்கள்.';
    }
    return 'Please say Confirm when you are ready to place the order.';
  },
  noInfo(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'அந்த தகவல் இப்போது என்னிடம் இல்லை.';
    }
    return "I don't have that information right now.";
  },
  cannotCancel(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'ஆப் மூலம் ஆர்டரை ரத்து செய்ய முடியாது. கடைக்கு தொடர்பு கொள்ளுங்கள்.';
    }
    return "I can't cancel an order from here. Please contact the shop.";
  },
  howToOrder(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'பொருளைத் தேர்ந்தெடுத்து கார்ட்டில் சேர்த்து, முகவரி கொடுத்து ஆர்டர் செய்யலாம். அல்லது என்னிடம் பேசி Confirm சொல்லலாம்.';
    }
    return 'Browse the catalog, add items, save an address, then place the order. Or tell me what you need and say Confirm.';
  },
  changeAddress(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'அக்கவுண்ட் அல்லது செக்அவுட்டில் டெலிவரி முகவரியை மாற்றலாம்.';
    }
    return 'You can change your delivery address from Account or at checkout.';
  },
  lastOrder(lang: SamLanguage, summary: string) {
    if (lang === 'ta') {
      return `கடைசி ஆர்டர்: ${summary}`;
    }
    return `Your last order: ${summary}`;
  },
  price(lang: SamLanguage, name: string, amount: number, available: boolean) {
    const money = rupee(amount);
    const stock = available ? '' : lang === 'ta' ? ' இப்போது கிடைக்கவில்லை.' : ' It is not available right now.';
    if (lang === 'ta') {
      return `${name} விலை ${money}.${stock}`;
    }
    return `${name} is ${money}.${stock}`;
  },
  unknown(lang: SamLanguage) {
    if (lang === 'ta') {
      return 'சற்று வேறுவிதமாகச் சொல்லுங்களேன்?';
    }
    if (lang === 'mix') {
      return 'Konjam clear-aa sollunga. Add, change, illa confirm.';
    }
    return "I didn't quite get that. You can add items, ask a product question, or say Confirm.";
  },
};
