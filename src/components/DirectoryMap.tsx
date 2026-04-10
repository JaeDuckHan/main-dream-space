import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Category = "전체" | "숙소" | "병원" | "한식당" | "부동산" | "비자" | "마트";

interface MarkerData {
  name: string;
  category: Exclude<Category, "전체">;
  lat: number;
  lng: number;
  info: string;
  tel: string;
}

const markers: MarkerData[] = [
  { name: "Monarque Hotel Danang", category: "숙소", lat: 16.0544, lng: 108.2478, info: "미케비치 / 약 5~10만원/박", tel: "+84 236 3588 888" },
  { name: "Chicland Hotel Danang Beach", category: "숙소", lat: 16.0557, lng: 108.2489, info: "보응우옌잡 / 약 7~14만원/박", tel: "+84 236 2232 222" },
  { name: "Altara Suites by Ri-Yaz", category: "숙소", lat: 16.0562, lng: 108.2493, info: "보응우옌잡 / 장기체류 추천", tel: "+84 236 268 7979" },
  { name: "Sanouva Danang Hotel", category: "숙소", lat: 16.0678, lng: 108.2205, info: "판쩌우찐 / 약 4~9만원/박", tel: "+84 236 3823 468" },
  { name: "Family Medical Practice", category: "병원", lat: 16.0712, lng: 108.2131, info: "하이쩌우 / 일반진료, 소아, 응급", tel: "+84 23 6358 2699" },
  { name: "Family Hospital Da Nang", category: "병원", lat: 16.0598, lng: 108.2148, info: "하이쩌우 / 내과, 외과, 응급", tel: "0236 3632 111" },
  { name: "Hoan My Da Nang Hospital", category: "병원", lat: 16.0720, lng: 108.2125, info: "하이쩌우 / 내과, 산부인과, 응급", tel: "0236 3650 676" },
  { name: "Vinmec Da Nang International", category: "병원", lat: 16.0544, lng: 108.2012, info: "국제병원 / 검진, 국제진료", tel: "문의 필요" },
  { name: "GoGi House Vincom Plaza", category: "한식당", lat: 16.0521, lng: 108.2441, info: "빈컴플라자 / 삼겹살, 소고기", tel: "" },
  { name: "Dookki Vincom Plaza", category: "한식당", lat: 16.0519, lng: 108.2443, info: "빈컴플라자 / 떡볶이 무한리필", tel: "" },
  { name: "KOGI BBQ Da Nang", category: "한식당", lat: 16.0398, lng: 108.2342, info: "안트엉 / 한식 바비큐, 삼겹살", tel: "" },
  { name: "BHC Chicken Da Nang", category: "한식당", lat: 16.0392, lng: 108.2348, info: "안트엉 / 후라이드, 양념치킨", tel: "" },
  { name: "First Real", category: "부동산", lat: 16.0689, lng: 108.2187, info: "다낭, 하이쩌우, 해안권", tel: "1900 633 034" },
  { name: "Dat Xanh Mien Trung", category: "부동산", lat: 16.0544, lng: 108.2022, info: "다낭, 중부권 분양/중개", tel: "1900 63 68 79" },
  { name: "Rever", category: "부동산", lat: 16.0711, lng: 108.2212, info: "전국 아파트/주거 플랫폼", tel: "1800 234 546" },
  { name: "Visa5s", category: "비자", lat: 16.0678, lng: 108.2231, info: "e-visa, VOA, 연장/초청", tel: "0944 555 010" },
  { name: "Vietnam-Visa", category: "비자", lat: 16.0655, lng: 108.2218, info: "e-visa, VOA, 한국인 안내", tel: "" },
  { name: "Visana", category: "비자", lat: 16.0640, lng: 108.2198, info: "e-visa, urgent, 비즈니스 비자", tel: "1900 3498" },
  { name: "K-Market / Kmart", category: "마트", lat: 16.0401, lng: 108.2356, info: "안트엉 / 한국 식재료, 생활용품", tel: "" },
  { name: "Lotte Mart Da Nang", category: "마트", lat: 16.0241, lng: 108.1961, info: "하이쩌우 / 대형마트, 식품관", tel: "" },
  { name: "MM Mega Market Da Nang", category: "마트", lat: 16.0389, lng: 108.2012, info: "창고형 / 대용량, 수입식품", tel: "" },
];

const categoryColors: Record<Exclude<Category, "전체">, string> = {
  숙소: "#3B82F6",
  병원: "#EF4444",
  한식당: "#F59E0B",
  부동산: "#10B981",
  비자: "#8B5CF6",
  마트: "#6B7280",
};

const categoryEmoji: Record<Exclude<Category, "전체">, string> = {
  숙소: "🔵",
  병원: "🔴",
  한식당: "🟡",
  부동산: "🟢",
  비자: "🟣",
  마트: "⚫",
};

function createIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

interface DirectoryMapProps {
  activeCategory: Category;
}

const DirectoryMap = ({ activeCategory }: DirectoryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([16.054, 108.237], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Legend
    const legend = new L.Control({ position: "topright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div");
      div.style.cssText = "background:white;padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-size:12px;line-height:1.8";
      div.innerHTML = (Object.keys(categoryColors) as Exclude<Category, "전체">[])
        .map(
          (cat) =>
            `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${categoryColors[cat]}"></span>${cat}</div>`
        )
        .join("");
      return div;
    };
    legend.addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    const filtered = activeCategory === "전체" ? markers : markers.filter((m) => m.category === activeCategory);

    filtered.forEach((m) => {
      const color = categoryColors[m.category];
      const icon = createIcon(color);
      const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
      const telHtml = m.tel ? `<div style="margin-top:4px;font-size:12px;color:#666">📞 ${m.tel}</div>` : "";
      const popup = `
        <div style="min-width:180px">
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">${m.name}</div>
          <span style="display:inline-block;padding:1px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:white;background:${color}">${m.category}</span>
          <div style="margin-top:6px;font-size:13px;color:#666">${m.info}</div>
          ${telHtml}
          <a href="${googleMapUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:13px;color:#3B82F6;text-decoration:none;font-weight:500">구글맵에서 보기 →</a>
        </div>
      `;
      L.marker([m.lat, m.lng], { icon }).bindPopup(popup).addTo(markersLayerRef.current!);
    });
  }, [activeCategory]);

  return <div ref={mapRef} className="w-full h-[400px] md:h-[600px] rounded-xl overflow-hidden border border-border" />;
};

export default DirectoryMap;
