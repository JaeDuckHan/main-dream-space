import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@luckydanang.com";

export interface OrderEmailData {
  id: number;
  orderer_email: string;
  orderer_name: string;
  product_title: string;
  total_price: number;
}

function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export async function sendPaymentCheckingEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 입금 확인 중입니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#0f172a">입금 확인 중입니다</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>아래 주문의 입금 내역을 확인 중입니다. 확인 완료 시 별도 안내 드리겠습니다.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0;font-weight:600;color:#1d4ed8">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}

export async function sendOrderConfirmedEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 주문이 확정되었습니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#15803d">주문이 확정되었습니다 ✅</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>주문이 확정되었습니다. 이용해 주셔서 감사합니다.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0;font-weight:600;color:#1d4ed8">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}

export async function sendOrderCancelledEmail(order: OrderEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to: order.orderer_email,
    subject: `[럭키다낭] 주문이 취소되었습니다 (#${order.id})`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#dc2626">주문이 취소되었습니다</h2>
        <p>${order.orderer_name}님, 안녕하세요.</p>
        <p>아래 주문이 취소되었습니다. 문의 사항이 있으시면 연락해 주세요.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#64748b">주문 번호</td><td style="padding:8px 0;font-weight:600">#${order.id}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">상품명</td><td style="padding:8px 0">${order.product_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">결제 금액</td><td style="padding:8px 0">${formatPrice(order.total_price)}</td></tr>
        </table>
        <p style="color:#64748b;font-size:14px">환불 문의: ${FROM}</p>
        <p style="color:#94a3b8;font-size:12px">럭키다낭</p>
      </div>
    `,
  });
}
