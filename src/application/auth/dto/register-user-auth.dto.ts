export interface RegisterUserCommand {
  id: string;
  email: string;
  password: string;
  name: string;
  lastName: string;
}

export interface RegisterUserResult {
  id: string;
  email: string;
  name: string;
  lastName: string;
}
