// TypeScript interfaces and types

interface User {
  id: number;
  name: string;
  email: string;
}

type Status = "active" | "inactive" | "banned";

enum Role {
  Admin = "admin",
  User = "user",
  Guest = "guest",
}

class Account {
  private users: Map<string, User> = new Map();

  constructor(public name: string) {}

  addUser(user: User): void {
    this.users.set(user.email, user);
  }

  getUser(email: string): User | undefined {
    return this.users.get(email);
  }
}

function createUser(name: string, email: string): User {
  return { id: Date.now(), name, email };
}

const admin = createUser("Admin", "admin@test.com");
const account = new Account("Test Account");
account.addUser(admin);
