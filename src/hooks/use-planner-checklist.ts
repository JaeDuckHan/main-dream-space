import { useEffect, useState } from "react";

export interface PlannerChecklistItem {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  action_type: "external" | "internal" | "none";
  action_url: string | null;
  action_label: string | null;
  affiliate_partner: "agoda" | "booking" | "tripcom" | "skyscanner" | "none";
  icon: string | null;
  checked: boolean;
}

interface PlannerChecklistResponse {
  template: {
    id: number;
    slug: string;
    title: string;
    description: string | null;
  };
  items: PlannerChecklistItem[];
}

export function usePlannerChecklist(slug: string, sessionId: string | null) {
  const [items, setItems] = useState<PlannerChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/planner/checklist/${slug}?session_id=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load checklist: ${response.status}`);
        }
        return response.json() as Promise<PlannerChecklistResponse>;
      })
      .then((payload) => setItems(payload.items))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [sessionId, slug]);

  return { items, setItems, loading, error };
}
