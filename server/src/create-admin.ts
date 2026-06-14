/**
 * Create Admin CLI — creates a platform admin user.
 *
 * Usage:
 *   npx tsx src/create-admin.ts
 *
 * Prompts for email, name, and password interactively.
 * Alternatively, pass as arguments:
 *   npx tsx src/create-admin.ts admin@example.com "Admin Name" password123
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();

function prompt(question: string, silent = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (silent) {
      // For password input (basic approach - characters still visible but we indicate it's hidden)
      process.stdout.write(question);
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("🔐 Create Platform Admin\n");

  const args = process.argv.slice(2);

  let email: string;
  let name: string;
  let password: string;

  if (args.length >= 3) {
    [email, name, password] = args;
    // Validate
    if (!email.includes("@")) throw new Error("Invalid email format");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
  } else {
    email = await prompt("Email: ");
    if (!email.includes("@")) throw new Error("Invalid email format");

    name = await prompt("Full name: ");
    if (!name) throw new Error("Name is required");

    password = await prompt("Password (min 8 chars): ");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
  }

  // Check if email already exists
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.error(`\n❌ Admin with email "${email}" already exists.`);
    process.exit(1);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create admin
  const admin = await prisma.admin.create({
    data: { email, name, passwordHash },
  });

  console.log(`\n✅ Admin created successfully!`);
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name:  ${admin.name}`);
  console.log(`\n🌐 Login at: http://localhost:3001/auth/login (select Admin tab)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
