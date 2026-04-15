const API_URL = "https://alimtalk.bizservice.iwinv.kr/api/v2/send/";

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

async function sendAlimtalk(
  templateCode: string,
  phone: string,
  templateParam: string[],
): Promise<void> {
  if (!process.env.IWINV_API_KEY) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  const auth = Buffer.from(process.env.IWINV_API_KEY).toString("base64");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      AUTH: auth,
    },
    body: JSON.stringify({
      templateCode,
      fail: [
        {
          "~phone": normalized,
          templateParam,
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`alimtalk failed (${response.status}): ${body}`);
  }
  const result = (await response.json().catch(() => ({}))) as { code?: number };
  if (result.code !== 200) {
    throw new Error(`alimtalk error code: ${result.code}`);
  }
}

// pending 변수 순서: #{이름} #{상품명} #{주문번호} #{주문금액} #{은행명} #{계좌번호} #{예금주} #{안내문구} #{이메일}
export async function sendPendingPaymentAlimtalk(
  order: OrderAlimtalkData,
  settings: BankSettings,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_PENDING ?? "";
  if (!templateCode) return;
  await sendAlimtalk(templateCode, order.orderer_phone, [
    order.orderer_name,
    order.product_title,
    String(order.id),
    formatPrice(order.total_price),
    settings.bank_name,
    settings.bank_account,
    settings.bank_holder,
    settings.bank_notice,
    settings.company_email,
  ]);
}

// checking/confirmed/cancelled 변수 순서: #{이름} #{상품명} #{주문번호} #{주문금액} #{이메일}
export async function sendPaymentCheckingAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CHECKING ?? "";
  if (!templateCode) return;
  await sendAlimtalk(templateCode, order.orderer_phone, [
    order.orderer_name,
    order.product_title,
    String(order.id),
    formatPrice(order.total_price),
    companyEmail,
  ]);
}

export async function sendOrderConfirmedAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CONFIRMED ?? "";
  if (!templateCode) return;
  await sendAlimtalk(templateCode, order.orderer_phone, [
    order.orderer_name,
    order.product_title,
    String(order.id),
    formatPrice(order.total_price),
    companyEmail,
  ]);
}

export async function sendOrderCancelledAlimtalk(
  order: OrderAlimtalkData,
  companyEmail: string,
): Promise<void> {
  const templateCode = process.env.IWINV_TEMPLATE_CANCELLED ?? "";
  if (!templateCode) return;
  await sendAlimtalk(templateCode, order.orderer_phone, [
    order.orderer_name,
    order.product_title,
    String(order.id),
    formatPrice(order.total_price),
    companyEmail,
  ]);
}
