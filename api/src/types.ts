import type {
  community as communityTable,
  membership as membershipTable,
  user as userTable,
} from "./drizzle/schema";

export type AuthVariables = {
  user?: typeof userTable.$inferSelect;
  community?: typeof communityTable.$inferSelect;
  membership?: typeof membershipTable.$inferSelect;
  isMasquerading?: boolean;
  originalUserId?: string;
};

export interface ProfilePicture {
  deletedAt: string | null;
  image: {
    id: string;
    key: string;
    filename: string;
    width: number;
    height: number;
  };
}
