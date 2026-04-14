const KAKAO_CHANNEL_URL = "http://pf.kakao.com/_JxnNxhX/chat";

const KakaoChannelButton = () => (
  <a
    href={KAKAO_CHANNEL_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="카카오톡 상담 채널"
    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-transform hover:scale-105 active:scale-95"
    style={{ backgroundColor: "#FEE500" }}
  >
    {/* 카카오 말풍선 아이콘 */}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.477 3 2 6.82 2 11.5c0 2.94 1.756 5.532 4.42 7.133L5.5 22l3.94-2.1A11.6 11.6 0 0 0 12 20c5.523 0 10-3.82 10-8.5S17.523 3 12 3Z"
        fill="#3C1E1E"
      />
    </svg>
    <span className="text-[13px] font-bold leading-tight text-[#3C1E1E]">
      시세보다 10% 할인<br />
      <span className="text-[12px] font-semibold">카카오톡 상담</span>
    </span>
  </a>
);

export default KakaoChannelButton;
