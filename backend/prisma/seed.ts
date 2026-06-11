import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('DevPassword123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: {},
    create: {
      email: 'dev@example.com',
      passwordHash,
      githubUsername: 'dev-user',
      dailyLimit: 10,
      watchedLabels: {
        create: [
          { labelName: 'Help Wanted' },
          { labelName: 'Good First Issue' },
        ],
      },
    },
  });

  console.log('Seeded user:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
