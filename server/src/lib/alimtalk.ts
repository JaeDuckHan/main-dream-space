const API_URL = "https://biz.service.iwinv.kr/api/send/";

export interface OrderAlimtalkData {
  id: number;
  orderer_name: string;
  orderer_phone: string;
  product_title: string;
  total_price: number;
}

export interface BankSettings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
  company_email: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function buildMessage(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`#{${key}}`, val),
    template,
  );
}

async function sendAlimtalk(
  templateCode: string,
  phone: string,
  message: string,
): Promise<void> {
  if (!process.env.IWINV_API_KEY) return;
  const auth = Buffer.from(process.env.IWINV_API_KEY).toString("base64");
  const senderKey = process.env.IWINV_SENDER_KEY ?? "";
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      AUTH: auth,
    },
    body: JSON.stringify({
      sender_key: senderKey,
      template_code: templateCode,
      phone_number: normalizePhone(phone),
      message,
      fall_back_yn: false,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`alimtalk failed (${response.status}): ${body}`);
  }
}

// 템플릿 문구 (iwinv에 등록된 내용과 완전히 일치해야 함)
const TEMPLATES = {
  pending: [
    "[럭키다낭] 주문이 접수되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "주문이 정상적으로 접수되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "━━ 무통장 입금 안내 ━━",
    "은행명: #{은행명}",
    "계좌번호: #{계좌번호}",
    "예금주: #{예금주}",
    "",
    "#{안내문구}",
    "",
    "입금 확인 후 카카오톡으로 안내드립니다.",
    "문의: #{이메일}",
  ].join("\n"),

  checking: [
    "[럭키다낭] 입금 확인 중입니다",
    "",
    "안녕하세요, #{이름}님.",
    "담당자가 입금 내역을 확인하고 있습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "확인이 완료되면 카카오톡으로 안내드립니다.",
    "문의: #{이메일}",
  ].join("\n"),

  confirmed: [
    "[럭키다낭] 주문이 확정되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "주문이 최종 확정되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "즐거운 다낭 여행 되세요!",
    "문의: #{이메일}",
  ].join("\n"),

  cancelled: [
    "[럭키다낭] 주문이 취소되었습니다",
    "",
    "안녕하세요, #{이름}님.",
    "아래 주문이 취소 처리되었습니다.",
    "",
    "■ 상품명: #{상품명}",
    "■ 주문번호: #{주문번호}",
    "■ 결제금액: #{주문금액}원",
    "",
    "환불 관련 문의는 아래 이메일로 연락해주세요.",
    "문의: #{이메일}",
  ].join("\n"),
};

export async function sendPendingPaymentAlimtalk(
  order: OrderAlimtalkData,
  settings: BankSettings,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_PENDING ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.pending, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    은행명: settings.bank_name,
    계좌번호: settings.bank_account,
    예금주: settings.bank_holder,
    안내문구: settings.bank_notice,
    이메일: settings.company_email,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendPaymentCheckingAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CHECKING ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.checking, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendOrderConfirmedAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CONFIRMED ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.confirmed, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}

export async function sendOrderCancelledAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CANCELLED ?? "";
  if (!templateCode) return;
  const message = buildMessage(TEMPLATES.cancelled, {
    이름: order.orderer_name,
    상품명: order.product_title,
    주문번호: String(order.id),
    주문금액: formatPrice(order.total_price),
    이메일: companyEmail,
  });
  await sendAlimtalk(templateCode, order.orderer_phone, message);
}
