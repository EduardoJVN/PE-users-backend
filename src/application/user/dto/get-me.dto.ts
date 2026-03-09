export interface GetMeCommand {
  userId: string;
}

export interface GetMeResult {
  id: string;
  email: string;
  name: string;
  lastName: string;
  avatarUrl: string | null;
  statusId: number;
  roleId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
