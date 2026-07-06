import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.admin.update({ 
    where: { email: 'admin@leadbridge.com' }, 
    data: { passwordHash: hash } 
  });
  console.log('✅ Password reset to: admin123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
