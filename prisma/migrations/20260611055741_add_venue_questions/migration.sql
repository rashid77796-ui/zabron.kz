-- CreateTable
CREATE TABLE "VenueQuestion" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VenueQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VenueQuestion" ADD CONSTRAINT "VenueQuestion_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
