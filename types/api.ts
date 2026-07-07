type NoPerms = {
  ok: false;
  error: "no_perms";
};

type AdminRolesEntityListAssignments = {
  ok: true;
  role_assignments: {
    role_id: string;
    users: string[];
  }[];
};

export type Api = {
  "admin.roles.entity.listAssignments":
    AdminRolesEntityListAssignments | NoPerms;
};
