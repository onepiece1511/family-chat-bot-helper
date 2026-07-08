import { RISK_ESCALATION_MESSAGE } from "./prompts.js";

export interface RedactionResult {
  text: string;
  redactions: string[];
}

export interface RiskDetectionResult {
  isRisky: boolean;
  categories: string[];
}

const RISK_KEYWORDS: Record<string, RegExp[]> = {
  medical: [
    /bác sĩ/i,
    /thuốc/i,
    /liều/i,
    /bệnh/i,
    /triệu chứng/i,
    /chẩn đoán/i,
    /medical|doctor|medicine|dosage|symptom/i
  ],
  legal: [/pháp lý/i, /\bluật\b/i, /kiện/i, /tòa án/i, /luật sư/i, /legal|lawyer|court/i],
  financial: [/tài chính/i, /đầu tư/i, /cổ phiếu/i, /vay/i, /nợ/i, /lãi suất/i, /investment|loan|debt|stock/i],
  banking: [/ngân hàng/i, /chuyển khoản/i, /\bstk\b/i, /số tài khoản/i, /\both?p\b/i, /bank|transfer|account number/i],
  insurance: [/bảo hiểm/i, /insurance/i],
  tax: [/\bthuế\b/i, /tax/i],
  immigration: [/visa/i, /di trú/i, /nhập cư/i, /quốc tịch/i, /hộ chiếu/i, /passport|immigration|citizenship/i],
  property: [/nhà đất/i, /bất động sản/i, /sổ đỏ/i, /mua nhà/i, /bán nhà/i, /property|mortgage|real estate/i],
  contracts: [/hợp đồng/i, /ký giấy/i, /contract|agreement/i],
  identity: [/\bcccd\b/i, /\bcmnd\b/i, /căn cước/i, /hộ chiếu/i, /passport|id card|identity/i],
  password: [/mật khẩu/i, /password/i, /passcode/i]
};

export function redactSensitiveContent(input: string): RedactionResult {
  let text = input;
  const redactions = new Set<string>();

  const apply = (pattern: RegExp, replacement: string, label: string) => {
    text = text.replace(pattern, () => {
      redactions.add(label);
      return replacement;
    });
  };

  apply(/\b(?:otp|mã otp|ma otp|mã xác thực|ma xac thuc|verification code|security code)\s*[:\-]?\s*\d{4,8}\b/gi, "[REDACTED_OTP]", "otp");
  apply(/\b(?:password|passcode|mật khẩu|mat khau)\s*[:\-]?\s*\S+/gi, "[REDACTED_PASSWORD]", "password");
  apply(/\b(?:passport|hộ chiếu|ho chieu)\s*(?:number|số|so)?\s*[:\-]?\s*[A-Z0-9]{6,12}\b/gi, "[REDACTED_PASSPORT]", "passport");
  apply(/\b(?:số tài khoản|so tai khoan|stk|bank account|account number|ngân hàng|ngan hang)\s*[:\-]?\s*[0-9][0-9\s\-]{5,24}\b/gi, "[REDACTED_BANK_ACCOUNT]", "bank_account");

  text = redactLikelyCardNumbers(text, redactions);

  return { text, redactions: Array.from(redactions).sort() };
}

export function detectRiskyTopic(message: string): RiskDetectionResult {
  const categories = Object.entries(RISK_KEYWORDS)
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(message)))
    .map(([category]) => category);

  return {
    isRisky: categories.length > 0,
    categories
  };
}

export function buildRiskyTopicReply(): string {
  return RISK_ESCALATION_MESSAGE;
}

function redactLikelyCardNumbers(text: string, redactions: Set<string>): string {
  return text.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    const looksGrouped = /(?:\d{4}[ -]){3,4}\d{1,4}/.test(match);
    if (digits.length < 13 || digits.length > 19) return match;
    if (!looksGrouped && !passesLuhn(digits)) return match;

    redactions.add("bank_card");
    return "[REDACTED_CARD]";
  });
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (shouldDouble) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
