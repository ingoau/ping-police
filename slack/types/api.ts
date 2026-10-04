import type {
  ConversationsInfoResponse,
  ConversationsJoinResponse,
  ConversationsInviteResponse,
  UsergroupsListResponse,
  UsergroupsUsersListResponse,
} from "@slack/web-api";

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
  "conversations.view": ConversationsInfoResponse;
  "conversations.info": ConversationsInfoResponse;
  "conversations.join": ConversationsJoinResponse;
  "conversations.invite": ConversationsInviteResponse;
  "usergroups.list": UsergroupsListResponse;
  "usergroups.users.list": UsergroupsUsersListResponse;
};
