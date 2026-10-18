import { authorizedFetch } from "@/lib/apiClient";

export type VenueActionKind = "approve" | "request_changes" | "reject" | "hide" | "unhide" | "reopen";

const PATH: Record<VenueActionKind, string> = {
  approve: "approve",
  request_changes: "request-changes",
  reject: "reject",
  hide: "hide",
  unhide: "unhide",
  reopen: "reopen",
};

// One admin action on one venue (POST /api/admin/manage/venues/:id/<action>).
// `reason` is sent for the actions that take one (request changes, reject,
// hide). Never throws: failures come back as { success: false, error }.
export async function runVenueAction(
  venueId: string,
  kind: VenueActionKind,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authorizedFetch(`/api/admin/manage/venues/${venueId}/${PATH[kind]}`, {
      method: "POST",
      body: JSON.stringify(reason === undefined ? {} : { reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error ?? "Action failed. Try again." };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Action failed. Try again." };
  }
}
