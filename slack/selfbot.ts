import * as api from "./api";

const CHANNEL_MANAGER_ROLE_ID = "Rl0A";

export async function getManagers(channelId: string) {
  const result = await api.selfbot("admin.roles.entity.listAssignments", {
    entity_id: channelId,
  });

  if (!result.ok) return [];

  return (
    result.role_assignments.find(
      (assignment) => assignment.role_id === CHANNEL_MANAGER_ROLE_ID,
    )?.users ?? []
  );
}
