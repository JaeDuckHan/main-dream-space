// server/src/jobs/planner-reminders.ts
import cron from "node-cron";
import { query } from "../db.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ReminderRow {
  id: number;
  email: string;
  plan_id: string;
  plan_title: string;
  plan_data: { city: string; startDate: string; checklist: Record<string, boolean> };
  remind_at: string;
}

async function sendPendingReminders() {
  const rows = await query<ReminderRow>(
    `SELECT r.id, r.email, r.plan_id,
            p.title AS plan_title,
            p.data AS plan_data
     FROM planner_reminders r
     JOIN planner_plans p ON p.id = r.plan_id
     WHERE r.sent = false AND r.remind_at <= NOW()`,
    [],
  );

  for (const row of rows) {
    const unchecked = Object.values(row.plan_data.checklist || {}).filter(v => !v).length;
    const startDate = row.plan_data.startDate
      ? new Date(row.plan_data.startDate).toLocaleDateString("ko-KR")
      : "미정";
    const dDay = row.plan_data.startDate
      ? Math.ceil((new Date(row.plan_data.startDate).getTime() - Date.now()) / 86400000)
      : null;

    try {
      await resend.emails.send({
        from: "럭키다낭 <noreply@luckydanang.com>",
        to: row.email,
        subject: `${row.plan_data.city} 출발${dDay ? ` D-${dDay}` : ""}! 체크리스트 ${unchecked}개가 남았어요`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">${row.plan_title || row.plan_data.city + " 한달살기 플랜"}</h2>
            <p style="color:#555">출발일 <strong>${startDate}</strong>까지 아직 <strong>${unchecked}개</strong>의 체크리스트가 남았어요.</p>
            <a href="${process.env.VITE_SITE_URL || "https://luckydanang.com"}/planner"
               style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
              플래너 확인하기
            </a>
          </div>`,
      });

      await query(`UPDATE planner_reminders SET sent = true WHERE id = $1`, [row.id]);
    } catch (err) {
      console.error(`[planner-reminders] 이메일 발송 실패 id=${row.id}:`, err);
    }
  }
}

export function startPlannerReminderJob() {
  // 매일 오전 9시 KST (00:00 UTC)
  cron.schedule("0 0 * * *", () => {
    sendPendingReminders().catch(err => console.error("[planner-reminders] cron error:", err));
  });
  console.log("[planner-reminders] cron job registered (daily 09:00 KST)");
}
