import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const categories = [
    { slug: 'bath', nameRu: 'Бани и сауны', nameKk: 'Моншалар мен саунalar', nameEn: 'Baths & Saunas' },
    { slug: 'spa', nameRu: 'Спа и велнес', nameKk: 'Спа және велнес', nameEn: 'Spa & Wellness' },
    { slug: 'restaurant', nameRu: 'Рестораны', nameKk: 'Мейрамханалар', nameEn: 'Restaurants' },
    { slug: 'entertainment', nameRu: 'Развлечения', nameKk: 'Ойын-сауық', nameEn: 'Entertainment' },
    { slug: 'outdoor', nameRu: 'Зоны отдыха', nameKk: 'Демалыс аймақтары', nameEn: 'Recreation' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { nameRu: cat.nameRu, nameKk: cat.nameKk, nameEn: cat.nameEn },
      create: cat,
    })
  }

  console.log(`Seeded ${categories.length} categories`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
