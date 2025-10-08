/**
 * Application types
 */

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface Application {
  id: string;
  profile_name: string;
  profile_username: string;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason?: string | null;
  attachments?: Array<{
    id: string;
    image_id: string;
    image_url: {
      key: string;
      id: string;
      created_at: string;
      deleted_at: string | null;
      width: number;
      height: number;
      filename: string;
      url: string;
    };
    created_at: string;
  }>;
}

export interface ApplicationStatusInfo {
  status: string;
  application_id: string;
  created_at: string;
  message: string | null;
  rejection_reason?: string | null;
  attachments?: Application["attachments"];
}
