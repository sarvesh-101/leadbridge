import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Guard: this is a LOCAL dev utility that creates a weak admin password.
// Refuse to run in production unless explicitly allowed (opt-in flag) so it
// can never accidentally reset the live admin to 'admin123'.
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_ADMIN_PW_RESET) {
  console.error("❌ Refusing to run in production — this creates a weak admin password.");
  console.error("   If you truly need to reset the production admin password, re-run with ALLOW_ADMIN_PW_RESET=true and change it immediately after.");
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.admin.update({ 
    where: { email: 'admin@converza.tech' }, 
    data: { passwordHash: hash } 
  });
  console.log('✅ Password reset to: admin123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
