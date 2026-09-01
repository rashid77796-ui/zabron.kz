-- AlterTable: make clientUserId nullable and add guest fields
ALTER TABLE "Booking" ALTER COLUMN "clientUserId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
