-- Backup aplikasi PT Istana Block (app.kirimistanablock.com)
-- Dibuat: 26/10/2026, 10.00.00
-- Tabel: 34, baris: 125. Isi tabel sessions sengaja tidak disimpan.
PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE `activityLogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`userId` integer,
	`userName` text,
	`role` text,
	`dutyOfficerName` text,
	`action` text NOT NULL,
	`label` text NOT NULL,
	`summary` text,
	`details` text,
	`success` integer DEFAULT true NOT NULL,
	`ip` text,
	`device` text,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE `backupRuns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`userId` integer,
	`userName` text,
	`folder` text,
	`tables` integer DEFAULT 0 NOT NULL,
	`rows` integer DEFAULT 0 NOT NULL,
	`photos` integer DEFAULT 0 NOT NULL,
	`newPhotos` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE `calendarEvents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'rapat' NOT NULL,
	`startAt` integer NOT NULL,
	`endAt` integer,
	`location` text,
	`description` text,
	`reminderMinutes` text NOT NULL,
	`seriesId` text,
	`createdBy` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `calendarParticipants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `calendarEvents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `calendarReminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`minutesBefore` integer NOT NULL,
	`remindAt` integer NOT NULL,
	`sentAt` integer,
	FOREIGN KEY (`eventId`) REFERENCES `calendarEvents`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `calendarResults` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eventId` integer NOT NULL,
	`leader` text,
	`category` text,
	`summary` text,
	`attendees` text DEFAULT '[]' NOT NULL,
	`guests` text,
	`durationHours` real,
	`evaluation` text,
	`notes` text,
	`files` text DEFAULT '[]' NOT NULL,
	`filledBy` integer,
	`filledByName` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`eventId`) REFERENCES `calendarEvents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`filledBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE `customerAddresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customerId` integer NOT NULL,
	`label` text DEFAULT 'Utama' NOT NULL,
	`recipientName` text NOT NULL,
	`recipientPhone` text,
	`addressText` text NOT NULL,
	`city` text,
	`province` text,
	`latitude` real,
	`longitude` real,
	`shareLocationUrl` text,
	`deliveryNotes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`notes` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` integer NOT NULL,
	`driverId` integer,
	`vehicleId` integer,
	`scheduledAt` integer,
	`status` text DEFAULT 'unassigned' NOT NULL,
	`startedAt` integer,
	`arrivedAt` integer,
	`completedAt` integer,
	`cancelledAt` integer,
	`delayReason` text,
	`driverNotes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `deliveryNotifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deliveryId` integer NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`readAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `deliveryProofs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deliveryId` integer NOT NULL,
	`proofType` text DEFAULT 'photo' NOT NULL,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`originalName` text,
	`createdBy` integer,
	`createdByDriver` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdByDriver`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `deliveryStatusHistory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deliveryId` integer NOT NULL,
	`fromStatus` text,
	`toStatus` text NOT NULL,
	`changedBy` integer,
	`changedByDriver` integer,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `dutyOfficerName` text,
	FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changedByDriver`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `driverLocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deliveryId` integer NOT NULL,
	`driverId` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`accuracyMeters` real,
	`recordedAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `drivers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`name` text NOT NULL,
	`phone` text,
	`licenseNumber` text,
	`licenseExpiryDate` integer,
	`isAvailable` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `dutyOfficers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accountUserId` integer NOT NULL,
	`name` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `pinHash` text, `failedAttempts` integer DEFAULT 0 NOT NULL, `lockedUntil` integer,
	FOREIGN KEY (`accountUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `dutyShifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`accountUserId` integer NOT NULL,
	`officerId` integer NOT NULL,
	`officerName` text NOT NULL,
	`startedAt` integer NOT NULL,
	`endedAt` integer,
	`handoverNote` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`accountUserId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`officerId`) REFERENCES `dutyOfficers`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `goodsReceipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`receivedAt` integer NOT NULL,
	`category` text DEFAULT 'bahan_baku' NOT NULL,
	`itemName` text NOT NULL,
	`tag` text,
	`supplier` text,
	`quarry` text,
	`quantity` real,
	`unit` text DEFAULT 'm³' NOT NULL,
	`vehiclePlate` text,
	`driverName` text,
	`deliveryNoteNo` text,
	`deliveryMode` text,
	`expeditionName` text,
	`hasBrangkal` integer,
	`status` text DEFAULT 'diterima' NOT NULL,
	`photoUrls` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`dutyOfficerName` text,
	`tier` integer,
	`qualityNote` text,
	`qualityBy` integer,
	`qualityAt` integer,
	`speedRating` integer,
	`deliveryNote` text,
	`deliveryBy` integer,
	`deliveryAt` integer,
	`createdBy` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `priceRating` integer, `priceNote` text, `priceBy` integer REFERENCES users(id), `priceAt` integer,
	FOREIGN KEY (`qualityBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliveryBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `isoRecords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`formCode` text NOT NULL,
	`kind` text DEFAULT 'record' NOT NULL,
	`recordDate` text NOT NULL,
	`sourceKey` text,
	`number` text,
	`data` text NOT NULL,
	`history` text DEFAULT '[]' NOT NULL,
	`createdBy` integer,
	`createdByName` text,
	`updatedByName` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE TABLE `mixDesignLogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workDate` integer NOT NULL,
	`layer` text NOT NULL,
	`product` text NOT NULL,
	`mixDesignId` integer,
	`approvedMaterials` text NOT NULL,
	`actualMaterials` text NOT NULL,
	`mixingCount` real,
	`boards` real,
	`squareMeters` real,
	`rejects` real,
	`status` text DEFAULT 'sesuai' NOT NULL,
	`notes` text,
	`createdBy` integer,
	`managerSignedBy` integer,
	`managerSignedAt` integer,
	`leaderSignedBy` integer,
	`leaderSignedAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `reviewStatus` text DEFAULT 'menunggu' NOT NULL, `reviewNote` text,
	FOREIGN KEY (`mixDesignId`) REFERENCES `mixDesigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`managerSignedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leaderSignedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `mixDesigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`layer` text NOT NULL,
	`product` text NOT NULL,
	`materials` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'diajukan' NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdBy` integer,
	`approvedBy` integer,
	`approvedAt` integer,
	`reviewNote` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `retiredReason` text, `retiredBy` integer REFERENCES users(id), `retiredAt` integer,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `orderDeletionAudit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`originalOrderId` integer NOT NULL,
	`poNumber` text NOT NULL,
	`customerName` text,
	`customerPhone` text,
	`reason` text NOT NULL,
	`snapshot` text NOT NULL,
	`deletedBy` integer,
	`deletedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`deletedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `orderItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` integer NOT NULL,
	`productId` integer,
	`productNameSnapshot` text NOT NULL,
	`specificationSnapshot` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unitPrice` real DEFAULT 0 NOT NULL,
	`lineTotal` real DEFAULT 0 NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poNumber` text NOT NULL,
	`customerId` integer NOT NULL,
	`deliveryAddressId` integer NOT NULL,
	`orderDate` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`requestedDeliveryDate` integer,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`deliveryFee` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`totalAmount` real DEFAULT 0 NOT NULL,
	`deliveryAddressSnapshot` text,
	`notes` text,
	`cancellationReason` text,
	`cancelledBy` integer,
	`cancelledAt` integer,
	`createdBy` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `externalRef` text, `paymentStatus` text, `paymentConfirmedBy` text, `paymentConfirmedAt` integer,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliveryAddressId`) REFERENCES `customerAddresses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelledBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `productionOutputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productionDate` integer NOT NULL,
	`category` text NOT NULL,
	`product` text NOT NULL,
	`spec` text,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`boards` real,
	`rejects` real,
	`photoUrl` text,
	`notes` text,
	`dutyOfficerName` text,
	`createdBy` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `issues` text DEFAULT '[]' NOT NULL, `batchCode` text, `leader` text, `target` real, `cementBags` real,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`unit` text DEFAULT 'buah' NOT NULL,
	`defaultPrice` real,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
CREATE TABLE `publicTrackingLinks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deliveryId` integer NOT NULL,
	`tokenHash` text NOT NULL,
	`expiresAt` integer,
	`isRevoked` integer DEFAULT false NOT NULL,
	`lastAccessedAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `pushSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `qualityControlNotifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` integer NOT NULL,
	`type` text DEFAULT 'new_order' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`readAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE "sandTests" (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`receiptId` integer,
	`status` text DEFAULT 'selesai' NOT NULL,
	`testedAt` integer NOT NULL,
	`completedAt` integer,
	`supplier` text,
	`quarry` text,
	`sandType` text NOT NULL,
	`readingUnit` text DEFAULT 'cm' NOT NULL,
	`sandHeightCm` real,
	`siltHeightCm` real,
	`siltPercent` real,
	`maxSiltPercent` real NOT NULL,
	`decision` text,
	`startPhotoUrl` text,
	`photoUrl` text,
	`notes` text,
	`dutyOfficerName` text,
	`completedByName` text,
	`createdBy` integer,
	`completedBy` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`receiptId`) REFERENCES `goodsReceipts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tokenHash` text NOT NULL,
	`userId` integer NOT NULL,
	`expiresAt` integer NOT NULL,
	`userAgent` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `strengthTestSamples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`testId` integer NOT NULL,
	`position` integer NOT NULL,
	`sampleName` text NOT NULL,
	`madeAt` integer,
	`testedAt` integer,
	`weightKg` real,
	`areaCm2` real,
	`maxLoadKn` real,
	FOREIGN KEY (`testId`) REFERENCES `strengthTests`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `strengthTests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reportDate` integer NOT NULL,
	`companyName` text,
	`address` text,
	`concreteGrade` text NOT NULL,
	`addressedTo` text,
	`composition` text NOT NULL,
	`notes` text,
	`createdBy` integer,
	`labSignedBy` integer,
	`labSignedAt` integer,
	`leaderSignedBy` integer,
	`leaderSignedAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL, `reviewStatus` text DEFAULT 'menunggu' NOT NULL, `reviewNote` text,
	FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`labSignedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leaderSignedBy`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text,
	`phone` text,
	`email` text,
	`role` text NOT NULL,
	`passwordHash` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`failedAttempts` integer DEFAULT 0 NOT NULL,
	`lockedUntil` integer,
	`lastSignedIn` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
, `mustChangePassword` integer DEFAULT false NOT NULL, `canCompleteOrders` integer DEFAULT false NOT NULL, `canViewSandTests` integer DEFAULT false NOT NULL, `canApproveQc` integer DEFAULT false NOT NULL, `canSignAsLeader` integer DEFAULT false NOT NULL, `signatureUrl` text, `canRatePrice` integer DEFAULT false NOT NULL, `canViewSummary` integer DEFAULT false NOT NULL);
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plateNumber` text NOT NULL,
	`vehicleType` text DEFAULT 'Truk' NOT NULL,
	`capacityNote` text,
	`stnkExpiryDate` integer,
	`kirExpiryDate` integer,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);

-- activityLogs: 4 baris
INSERT INTO "activityLogs" ("id","at","userId","userName","role","dutyOfficerName","action","label","summary","details","success","ip","device") VALUES (1,1792893600000,1,'Siti Customer Service','superadmin',NULL,'auth.login','Login','Login berhasil',NULL,1,'203.0.113.5','Chrome / Windows');
INSERT INTO "activityLogs" ("id","at","userId","userName","role","dutyOfficerName","action","label","summary","details","success","ip","device") VALUES (2,1792810800000,2,'Admin Kantor','admin',NULL,'order.create','Buat order','PO/2610/0010','{"customerId":1}',1,'203.0.113.6','Edge / Windows');
INSERT INTO "activityLogs" ("id","at","userId","userName","role","dutyOfficerName","action","label","summary","details","success","ip","device") VALUES (3,1792717200000,NULL,'orang tak dikenal',NULL,NULL,'auth.login','Login','Login gagal',NULL,0,'198.51.100.9',NULL);
INSERT INTO "activityLogs" ("id","at","userId","userName","role","dutyOfficerName","action","label","summary","details","success","ip","device") VALUES (4,1792630800000,4,'Satpam Gerbang','satpam','Satpam Joko','receipt.create','Terima barang','Pasir Cor 7 m³',NULL,1,NULL,NULL);

-- backupRuns: 2 baris
INSERT INTO "backupRuns" ("id","at","userId","userName","folder","tables","rows","photos","newPhotos") VALUES (1,1792378800000,1,'Siti Customer Service','PD.istana block purwakarta',33,120,10,10);
INSERT INTO "backupRuns" ("id","at","userId","userName","folder","tables","rows","photos","newPhotos") VALUES (2,1792983600000,1,'Siti Customer Service','unduhan (tanpa foto)',33,150,0,0);

-- calendarEvents: 2 baris
INSERT INTO "calendarEvents" ("id","title","type","startAt","endAt","location","description","reminderMinutes","seriesId","createdBy","createdAt","updatedAt") VALUES (1,'Rapat mingguan produksi','rapat',1792375200000,1792378800000,'Ruang rapat','Bahas target ''Oktober''','[60,15]','series-fixture-1',1,1791594000000,1791594000000);
INSERT INTO "calendarEvents" ("id","title","type","startAt","endAt","location","description","reminderMinutes","seriesId","createdBy","createdAt","updatedAt") VALUES (2,'Training K3','training',1793167200000,NULL,NULL,NULL,'[1440]',NULL,2,1792458000000,1792458000000);

-- calendarParticipants: 3 baris
INSERT INTO "calendarParticipants" ("id","eventId","userId") VALUES (1,1,1);
INSERT INTO "calendarParticipants" ("id","eventId","userId") VALUES (2,1,3);
INSERT INTO "calendarParticipants" ("id","eventId","userId") VALUES (3,2,8);

-- calendarReminders: 3 baris
INSERT INTO "calendarReminders" ("id","eventId","minutesBefore","remindAt","sentAt") VALUES (1,1,60,1792371600000,1792371600000);
INSERT INTO "calendarReminders" ("id","eventId","minutesBefore","remindAt","sentAt") VALUES (2,1,15,1792374300000,1792374300000);
INSERT INTO "calendarReminders" ("id","eventId","minutesBefore","remindAt","sentAt") VALUES (3,2,1440,1793080800000,NULL);

-- calendarResults: 1 baris
INSERT INTO "calendarResults" ("id","eventId","leader","category","summary","attendees","guests","durationHours","evaluation","notes","files","filledBy","filledByName","createdAt","updatedAt") VALUES (1,1,'Siti','Produksi','Target tercapai 90%','[{"userId":1,"name":"Siti Customer Service","present":true,"score":"A","note":null},{"userId":3,"name":"Pak Mandor Dedi","present":false,"score":null,"note":"Sakit"}]','2 orang tamu',1.5,'Baik',NULL,'[{"url":"/files/calendar/1790360000001-cl1aaaa1.pdf","name":"Notulen rapat.pdf","contentType":"application/pdf","size":198},{"url":"/files/calendar/1790360000002-cl1bbbb2.jpg","name":"Foto rapat.jpg","contentType":"image/jpeg","size":134}]',1,'Siti Customer Service',1792382400000,1792382400000);

-- customerAddresses: 5 baris
INSERT INTO "customerAddresses" ("id","customerId","label","recipientName","recipientPhone","addressText","city","province","latitude","longitude","shareLocationUrl","deliveryNotes","createdAt","updatedAt") VALUES (1,1,'Utama','Pak Rahmat','0811 0000 5663','Kawasan pabrik, gerbang 2, Kotabaru, Karawang','Karawang','Jawa Barat',-6.39791,107.42318,'https://www.google.com/maps?q=-6.39791,107.42318','Lapor satpam dulu',1790989200000,1790989200000);
INSERT INTO "customerAddresses" ("id","customerId","label","recipientName","recipientPhone","addressText","city","province","latitude","longitude","shareLocationUrl","deliveryNotes","createdAt","updatedAt") VALUES (2,1,'Gudang','Pak Ade',NULL,'Perumahan Karya Hunian, Cikampek','Karawang','Jawa Barat',NULL,NULL,NULL,NULL,1790989200000,1790989200000);
INSERT INTO "customerAddresses" ("id","customerId","label","recipientName","recipientPhone","addressText","city","province","latitude","longitude","shareLocationUrl","deliveryNotes","createdAt","updatedAt") VALUES (3,2,'Utama','Pak Udin','081234567801','Cluster Permata Indah, Babakancikao, Purwakarta','Purwakarta','Jawa Barat',-6.51582,107.47264,NULL,NULL,1790989200000,1790989200000);
INSERT INTO "customerAddresses" ("id","customerId","label","recipientName","recipientPhone","addressText","city","province","latitude","longitude","shareLocationUrl","deliveryNotes","createdAt","updatedAt") VALUES (4,3,'Toko','Ibu Maju','+6281234567802','Jl. Pahlawan No. 110, Cibatu','Purwakarta','Jawa Barat',-6.50967,107.53565,NULL,'Bongkar di belakang toko',1791075600000,1791075600000);
INSERT INTO "customerAddresses" ("id","customerId","label","recipientName","recipientPhone","addressText","city","province","latitude","longitude","shareLocationUrl","deliveryNotes","createdAt","updatedAt") VALUES (5,4,'Utama','Pak Haji Oman','6281234567803','Gg. Mawar No. 67, Plered','Purwakarta','Jawa Barat',NULL,NULL,NULL,NULL,1791075600000,1791075600000);

-- customers: 4 baris
INSERT INTO "customers" ("id","name","phone","email","notes","isActive","createdAt","updatedAt") VALUES (1,'PT Graha Asri Sentosa','+62 811-0000-2001','keuangan@graha.test','Developer; cocok HP & nama pelanggan demo web (demo-ct-c01)',1,1790989200000,1790989200000);
INSERT INTO "customers" ("id","name","phone","email","notes","isActive","createdAt","updatedAt") VALUES (2,'CV Karya Mandiri Konstruksi','081234567801',NULL,'Nama sama dgn demo-ct-c05 tapi HP beda',1,1790989200000,1790989200000);
INSERT INTO "customers" ("id","name","phone","email","notes","isActive","createdAt","updatedAt") VALUES (3,'Toko Bangunan Maju Jaya','+6281234567802',NULL,'Alamat: Jl. ''Pahlawan''
Baris kedua catatan',1,1791075600000,1791075600000);
INSERT INTO "customers" ("id","name","phone","email","notes","isActive","createdAt","updatedAt") VALUES (4,'Pak Haji Oman','6281234567803',NULL,NULL,0,1791075600000,1791594000000);

-- deliveries: 8 baris
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (1,3,NULL,NULL,1792634400000,'unassigned',NULL,NULL,NULL,NULL,NULL,NULL,1792544400000,1792645200000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (2,4,1,1,1792720800000,'ready',NULL,NULL,NULL,NULL,NULL,NULL,1792630800000,1792731600000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (3,5,2,2,1792720800000,'assigned',NULL,NULL,NULL,NULL,NULL,NULL,1792630800000,1792731600000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (4,6,1,1,1792807200000,'in_transit',1792809000000,NULL,NULL,NULL,NULL,NULL,1792717200000,1792818000000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (5,10,2,3,1792893600000,'arrived',1792895400000,1792900800000,NULL,NULL,NULL,NULL,1792803600000,1792904400000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (6,7,1,1,1792375200000,'delivered',1792377000000,1792382400000,1792386000000,NULL,NULL,'Diterima Pak Rahmat',1792285200000,1792386000000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (7,8,3,2,1792893600000,'delayed',1792895400000,NULL,NULL,NULL,'Hujan deras, jalan licin',NULL,1792803600000,1792904400000);
INSERT INTO "deliveries" ("id","orderId","driverId","vehicleId","scheduledAt","status","startedAt","arrivedAt","completedAt","cancelledAt","delayReason","driverNotes","createdAt","updatedAt") VALUES (8,9,NULL,NULL,1792461600000,'cancelled',NULL,NULL,NULL,1792458000000,NULL,NULL,1792371600000,1792472400000);

-- deliveryNotifications: 2 baris
INSERT INTO "deliveryNotifications" ("id","deliveryId","status","title","message","readAt","createdAt") VALUES (1,4,'in_transit','Muatan berangkat','PO/2610/0006 sedang diantar',NULL,1792809000000);
INSERT INTO "deliveryNotifications" ("id","deliveryId","status","title","message","readAt","createdAt") VALUES (2,6,'delivered','Muatan tiba','PO/2610/0007 diterima',1792389600000,1792386000000);

-- deliveryProofs: 4 baris
INSERT INTO "deliveryProofs" ("id","deliveryId","proofType","fileKey","fileUrl","originalName","createdBy","createdByDriver","createdAt") VALUES (1,6,'photo','delivery-proofs/6/1790500000001-pf6aaaa1.jpg','/files/delivery-proofs/6/1790500000001-pf6aaaa1.jpg','muatan.jpg',NULL,1,1792386000000);
INSERT INTO "deliveryProofs" ("id","deliveryId","proofType","fileKey","fileUrl","originalName","createdBy","createdByDriver","createdAt") VALUES (2,6,'photo','delivery-proofs/6/1790500000002-pf6bbbb2.jpg','/files/delivery-proofs/6/1790500000002-pf6bbbb2.jpg',NULL,NULL,1,1792386000000);
INSERT INTO "deliveryProofs" ("id","deliveryId","proofType","fileKey","fileUrl","originalName","createdBy","createdByDriver","createdAt") VALUES (3,6,'signature','delivery-proofs/6/1790500000003-pf6cccc3.png','/files/delivery-proofs/6/1790500000003-pf6cccc3.png','ttd-penerima.png',2,NULL,1792389600000);
INSERT INTO "deliveryProofs" ("id","deliveryId","proofType","fileKey","fileUrl","originalName","createdBy","createdByDriver","createdAt") VALUES (4,5,'photo','delivery-proofs/5/1790600000001-pf5dddd4.jpg','/files/delivery-proofs/5/1790600000001-pf5dddd4.jpg','tiba.jpg',NULL,2,1792900800000);

-- deliveryStatusHistory: 6 baris
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (1,6,NULL,'unassigned',2,NULL,NULL,1792285200000,NULL);
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (2,6,'unassigned','assigned',2,NULL,'Ditugaskan ke Asep',1792288800000,NULL);
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (3,6,'assigned','in_transit',NULL,1,NULL,1792377000000,NULL);
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (4,6,'in_transit','delivered',NULL,1,'Selesai',1792386000000,NULL);
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (5,7,'in_transit','delayed',4,NULL,'Hujan deras',1792897200000,'Satpam Joko');
INSERT INTO "deliveryStatusHistory" ("id","deliveryId","fromStatus","toStatus","changedBy","changedByDriver","note","createdAt","dutyOfficerName") VALUES (6,8,'unassigned','cancelled',2,NULL,'Order dibatalkan',1792458000000,NULL);

-- driverLocations: 3 baris
INSERT INTO "driverLocations" ("id","deliveryId","driverId","latitude","longitude","accuracyMeters","recordedAt","createdAt") VALUES (1,4,1,-6.5301,107.44,12.5,1792809600000,1792809600000);
INSERT INTO "driverLocations" ("id","deliveryId","driverId","latitude","longitude","accuracyMeters","recordedAt","createdAt") VALUES (2,4,1,-6.5222,107.45,9,1792810200000,1792810200000);
INSERT INTO "driverLocations" ("id","deliveryId","driverId","latitude","longitude","accuracyMeters","recordedAt","createdAt") VALUES (3,5,2,-6.4169,107.4518,NULL,1792900500000,1792900500000);

-- drivers: 3 baris
INSERT INTO "drivers" ("id","userId","name","phone","licenseNumber","licenseExpiryDate","isAvailable","createdAt","updatedAt") VALUES (1,5,'Asep Saepudin','0811 0000 4101','SIM-B1-0001',1825376400000,1,1790902800000,1790902800000);
INSERT INTO "drivers" ("id","userId","name","phone","licenseNumber","licenseExpiryDate","isAvailable","createdAt","updatedAt") VALUES (2,6,'Ujang Kurnia','+62 811-0000-4102',NULL,NULL,1,1790902800000,1790902800000);
INSERT INTO "drivers" ("id","userId","name","phone","licenseNumber","licenseExpiryDate","isAvailable","createdAt","updatedAt") VALUES (3,NULL,'Dede Rahmat','08110000 4103','SIM-B1-0003',1792544400000,0,1790902800000,1791939600000);

-- dutyOfficers: 2 baris
INSERT INTO "dutyOfficers" ("id","accountUserId","name","isActive","createdAt","pinHash","failedAttempts","lockedUntil") VALUES (1,4,'Satpam Joko',1,1790902800000,'pin-hash-fixture-1',0,NULL);
INSERT INTO "dutyOfficers" ("id","accountUserId","name","isActive","createdAt","pinHash","failedAttempts","lockedUntil") VALUES (2,4,'Satpam Budi',0,1790902800000,NULL,3,1792976400000);

-- dutyShifts: 2 baris
INSERT INTO "dutyShifts" ("id","accountUserId","officerId","officerName","startedAt","endedAt","handoverNote","createdAt") VALUES (1,4,1,'Satpam Joko',1792800000000,1792843200000,'Aman; 1 truk pasir tertunda',1792800000000);
INSERT INTO "dutyShifts" ("id","accountUserId","officerId","officerName","startedAt","endedAt","handoverNote","createdAt") VALUES (2,4,2,'Satpam Budi',1792886400000,NULL,NULL,1792886400000);

-- goodsReceipts: 3 baris
INSERT INTO "goodsReceipts" ("id","receivedAt","category","itemName","tag","supplier","quarry","quantity","unit","vehiclePlate","driverName","deliveryNoteNo","deliveryMode","expeditionName","hasBrangkal","status","photoUrls","notes","dutyOfficerName","tier","qualityNote","qualityBy","qualityAt","speedRating","deliveryNote","deliveryBy","deliveryAt","createdBy","createdAt","updatedAt","priceRating","priceNote","priceBy","priceAt") VALUES (1,1791766800000,'bahan_baku','Pasir Cor','A','CV Pasir Jaya','Galian Cikao',7,'m³','T 5555 XY','Pak Ikin','SJ-1201','quarry',NULL,0,'diterima','["/files/receipts/1790300000001-rc1aaaa1.jpg","/files/receipts/1790300000002-rc1bbbb2.jpg"]',NULL,'Satpam Joko',1,'Bersih',7,1791774000000,4,NULL,NULL,NULL,4,1791766800000,1791774000000,3,'Agak mahal',7,1791853200000);
INSERT INTO "goodsReceipts" ("id","receivedAt","category","itemName","tag","supplier","quarry","quantity","unit","vehiclePlate","driverName","deliveryNoteNo","deliveryMode","expeditionName","hasBrangkal","status","photoUrls","notes","dutyOfficerName","tier","qualityNote","qualityBy","qualityAt","speedRating","deliveryNote","deliveryBy","deliveryAt","createdBy","createdAt","updatedAt","priceRating","priceNote","priceBy","priceAt") VALUES (2,1791943200000,'bahan_baku','Semen PCC 50 kg',NULL,'Toko Semen Sejahtera',NULL,200,'sak',NULL,NULL,NULL,'ekspedisi','JNE Cargo',NULL,'diterima','["/files/receipts/1790310000001-rc2cccc3.jpg","/files/receipts/1790320000001-hilang00.jpg"]','Foto kedua sudah terhapus dari KV',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,4,1791943200000,1791943200000,NULL,NULL,NULL,NULL);
INSERT INTO "goodsReceipts" ("id","receivedAt","category","itemName","tag","supplier","quarry","quantity","unit","vehiclePlate","driverName","deliveryNoteNo","deliveryMode","expeditionName","hasBrangkal","status","photoUrls","notes","dutyOfficerName","tier","qualityNote","qualityBy","qualityAt","speedRating","deliveryNote","deliveryBy","deliveryAt","createdBy","createdAt","updatedAt","priceRating","priceNote","priceBy","priceAt") VALUES (3,1792108800000,'lainnya','Pasir Urug','B','CV Pasir Jaya','Galian Cikao',5.5,'m³','T 6666 ZZ','Pak Ujo','SJ-1202','quarry',NULL,1,'ditolak','[]','Banyak lumpur','Satpam Joko',3,'Ditolak',8,1792116000000,NULL,NULL,NULL,NULL,4,1792108800000,1792116000000,NULL,NULL,NULL,NULL);

-- isoRecords: 3 baris
INSERT INTO "isoRecords" ("id","formCode","kind","recordDate","sourceKey","number","data","history","createdBy","createdByName","updatedByName","createdAt","updatedAt") VALUES (1,'F-IB-01','record','2026-10-21',NULL,'001/F-IB-01/X/2026','{"a":"isian","b":12.5,"_from":"manual"}','[]',1,'Siti Customer Service',NULL,1792544400000,1792544400000);
INSERT INTO "isoRecords" ("id","formCode","kind","recordDate","sourceKey","number","data","history","createdBy","createdByName","updatedByName","createdAt","updatedAt") VALUES (2,'F-IB-03','supplement','2026-10','2026-10:5',NULL,'{"catatan":"pelengkap baris aplikasi"}','[{"at":1792630800000,"by":"Admin Kantor"}]',NULL,'Admin Kantor','Admin Kantor',1792630800000,1792717200000);
INSERT INTO "isoRecords" ("id","formCode","kind","recordDate","sourceKey","number","data","history","createdBy","createdByName","updatedByName","createdAt","updatedAt") VALUES (3,'F-IB-09','objective','2026-10',NULL,NULL,'{"sasaran":"Reject < 3%"}','[]',7,'Lukman QC',NULL,1792717200000,1792717200000);

-- mixDesignLogs: 2 baris
INSERT INTO "mixDesignLogs" ("id","workDate","layer","product","mixDesignId","approvedMaterials","actualMaterials","mixingCount","boards","squareMeters","rejects","status","notes","createdBy","managerSignedBy","managerSignedAt","leaderSignedBy","leaderSignedAt","createdAt","updatedAt","reviewStatus","reviewNote") VALUES (1,1792544400000,'badan','Paving Block',1,'[{"name":"Semen PCC","qty":50,"unit":"kg"},{"name":"Pasir","qty":120,"unit":"kg"}]','[{"name":"Semen PCC","qty":50,"unit":"kg"},{"name":"Pasir","qty":118,"unit":"kg"}]',12,240,36.5,3,'sesuai',NULL,8,7,1792573200000,7,1792576800000,1792544400000,1792576800000,'disetujui',NULL);
INSERT INTO "mixDesignLogs" ("id","workDate","layer","product","mixDesignId","approvedMaterials","actualMaterials","mixingCount","boards","squareMeters","rejects","status","notes","createdBy","managerSignedBy","managerSignedAt","leaderSignedBy","leaderSignedAt","createdAt","updatedAt","reviewStatus","reviewNote") VALUES (2,1792630800000,'kepalaan','Paving Block',NULL,'[{"name":"Semen PCC","qty":30,"unit":"kg"}]','[{"name":"Semen PCC","qty":35,"unit":"kg"}]',NULL,NULL,NULL,NULL,'tidak_sesuai','Semen lebih dari rencana',8,NULL,NULL,NULL,NULL,1792630800000,1792630800000,'revisi','Cek ulang timbangan');

-- mixDesigns: 3 baris
INSERT INTO "mixDesigns" ("id","name","layer","product","materials","notes","status","isActive","createdBy","approvedBy","approvedAt","reviewNote","createdAt","updatedAt","retiredReason","retiredBy","retiredAt") VALUES (1,'Paving K-300 badan','badan','Paving Block','[{"name":"Semen PCC","qty":50,"unit":"kg"},{"name":"Pasir","qty":120,"unit":"kg"},{"name":"Abu batu","qty":80,"unit":"kg"}]',NULL,'disetujui',1,8,7,1791162000000,NULL,1791075600000,1791162000000,NULL,NULL,NULL);
INSERT INTO "mixDesigns" ("id","name","layer","product","materials","notes","status","isActive","createdBy","approvedBy","approvedAt","reviewNote","createdAt","updatedAt","retiredReason","retiredBy","retiredAt") VALUES (2,'Paving kepalaan merah','kepalaan','Paving Block','[{"name":"Semen PCC","qty":30,"unit":"kg"},{"name":"Pigmen merah","qty":1.5,"unit":"kg"},{"name":"Pasir halus","qty":40,"unit":null}]','uji coba','diajukan',1,8,NULL,NULL,NULL,1792458000000,1792458000000,NULL,NULL,NULL);
INSERT INTO "mixDesigns" ("id","name","layer","product","materials","notes","status","isActive","createdBy","approvedBy","approvedAt","reviewNote","createdAt","updatedAt","retiredReason","retiredBy","retiredAt") VALUES (3,'Batako lama (gagal)','lainnya','Batako','[{"name":"Semen PCC","qty":null,"unit":"kg"}]',NULL,'gagal',0,8,7,1791248400000,'Retak',1791162000000,1791421200000,'Diganti desain baru',7,1791421200000);

-- orderDeletionAudit: 1 baris
INSERT INTO "orderDeletionAudit" ("id","originalOrderId","poNumber","customerName","customerPhone","reason","snapshot","deletedBy","deletedAt") VALUES (1,99,'PO/2610/0099','PT Graha Asri Sentosa','+62 811-0000-2001','Input ganda, salah ketik jumlah','{"order":{"id":99,"poNumber":"PO/2610/0099","status":"confirmed","totalAmount":1200000},"items":[{"productNameSnapshot":"Kanstin KS 20","quantity":80,"unit":"buah","unitPrice":15000}]}',1,1792400400000);

-- orderItems: 15 baris
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (1,1,1,'Paving Block — Truepave / bata 21 × 10,5 cm','tebal 6 cm, abu',40,'m²',85000,3400000,NULL,1792458000000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (2,1,2,'Kanstin KS 20',NULL,100,'buah',15000,1500000,NULL,1792458000000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (3,2,NULL,'Batako Press 10x20x40 (item lepas, tanpa produk)',NULL,500,'buah',4200,2100000,NULL,1792544400000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (4,3,1,'Paving Block — Truepave / bata 21 × 10,5 cm','tebal 6 cm, abu',40,'m²',85000,3400000,NULL,1792544400000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (5,3,2,'Kanstin KS 20',NULL,100,'buah',15000,1500000,NULL,1792544400000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (6,4,NULL,'Batako Press 10x20x40 (item lepas, tanpa produk)',NULL,500,'buah',4200,2100000,NULL,1792630800000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (7,5,1,'Paving Block — Truepave / bata 21 × 10,5 cm','tebal 6 cm, abu',40,'m²',85000,3400000,NULL,1792630800000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (8,5,2,'Kanstin KS 20',NULL,100,'buah',15000,1500000,NULL,1792630800000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (9,6,NULL,'Batako Press 10x20x40 (item lepas, tanpa produk)',NULL,500,'buah',4200,2100000,NULL,1792717200000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (10,7,1,'Paving Block — Truepave / bata 21 × 10,5 cm','tebal 6 cm, abu',40,'m²',85000,3400000,NULL,1792285200000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (11,7,2,'Kanstin KS 20',NULL,100,'buah',15000,1500000,NULL,1792285200000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (12,8,NULL,'Batako Press 10x20x40 (item lepas, tanpa produk)',NULL,500,'buah',4200,2100000,NULL,1792803600000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (13,9,1,'Paving Block — Truepave / bata 21 × 10,5 cm','tebal 6 cm, abu',40,'m²',85000,3400000,NULL,1792371600000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (14,9,2,'Kanstin KS 20',NULL,100,'buah',15000,1500000,NULL,1792371600000);
INSERT INTO "orderItems" ("id","orderId","productId","productNameSnapshot","specificationSnapshot","quantity","unit","unitPrice","lineTotal","notes","createdAt") VALUES (15,10,NULL,'Batako Press 10x20x40 (item lepas, tanpa produk)',NULL,500,'buah',4200,2100000,NULL,1792803600000);

-- orders: 10 baris
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (1,'PO/2610/0001',1,1,1792458000000,1792630800000,'draft',4900000,150000,0,5050000,'{"recipientName":"Pak Rahmat","addressText":"Kawasan pabrik, gerbang 2, Kotabaru, Karawang","city":"Karawang"}',NULL,NULL,NULL,NULL,2,1792458000000,1792472400000,NULL,NULL,NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (2,'PO/2610/0002',2,3,1792544400000,1792717200000,'confirmed',2100000,150000,0,2250000,'{"recipientName":"Pak Udin","addressText":"Cluster Permata Indah, Babakancikao","city":"Purwakarta"}',NULL,NULL,NULL,NULL,2,1792544400000,1792558800000,NULL,'belum_lunas',NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (3,'PO/2610/0003',3,4,1792544400000,1792717200000,'preparing',4900000,0,0,4900000,'{"recipientName":"Ibu Maju","addressText":"Jl. Pahlawan No. 110, Cibatu","city":"Purwakarta"}',NULL,NULL,NULL,NULL,2,1792544400000,1792558800000,'INV-0003','tempo',NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (4,'PO/2610/0004',1,2,1792630800000,1792803600000,'ready_to_ship',2100000,150000,0,2250000,'{"recipientName":"Pak Ade","addressText":"Perumahan Karya Hunian, Cikampek","city":"Karawang"}',NULL,NULL,NULL,NULL,2,1792630800000,1792645200000,'INV-0004','lunas','Admin Kantor',1792638000000);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (5,'PO/2610/0005',2,3,1792630800000,1792803600000,'assigned',4900000,150000,0,5050000,'{"recipientName":"Pak Udin","addressText":"Cluster Permata Indah, Babakancikao","city":"Purwakarta"}','Mohon bawa ''terpal''',NULL,NULL,NULL,2,1792630800000,1792645200000,NULL,'lunas','Admin Kantor',1792638000000);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (6,'PO/2610/0006',3,4,1792717200000,1792890000000,'in_delivery',2100000,0,0,2100000,'{"recipientName":"Ibu Maju","addressText":"Jl. Pahlawan No. 110, Cibatu","city":"Purwakarta"}',NULL,NULL,NULL,NULL,2,1792717200000,1792731600000,'INV-0006','belum_lunas',NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (7,'PO/2610/0007',1,1,1792285200000,1792458000000,'delivered',4900000,150000,50000,5000000,'{"recipientName":"Pak Rahmat","addressText":"Kawasan pabrik, gerbang 2, Kotabaru, Karawang","city":"Karawang"}',NULL,NULL,NULL,NULL,2,1792285200000,1792299600000,'INV-0007','lunas','Admin Kantor',1792292400000);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (8,'PO/2610/0008',2,3,1792803600000,1792976400000,'delayed',2100000,150000,0,2250000,'{"recipientName":"Pak Udin","addressText":"Cluster Permata Indah, Babakancikao","city":"Purwakarta"}',NULL,NULL,NULL,NULL,2,1792803600000,1792818000000,NULL,'tidak_diketahui',NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (9,'PO/2610/0009',4,5,1792371600000,1792544400000,'cancelled',4900000,0,0,4900000,'{"recipientName":"Pak Haji Oman","addressText":"Gg. Mawar No. 67, Plered","city":"Purwakarta"}',NULL,'Pelanggan membatalkan; proyek ditunda',2,1792479600000,2,1792371600000,1792386000000,NULL,NULL,NULL,NULL);
INSERT INTO "orders" ("id","poNumber","customerId","deliveryAddressId","orderDate","requestedDeliveryDate","status","subtotal","deliveryFee","discount","totalAmount","deliveryAddressSnapshot","notes","cancellationReason","cancelledBy","cancelledAt","createdBy","createdAt","updatedAt","externalRef","paymentStatus","paymentConfirmedBy","paymentConfirmedAt") VALUES (10,'PO/2610/0010',1,2,1792803600000,1792976400000,'in_delivery',2100000,150000,0,2250000,'{"recipientName":"Pak Ade","addressText":"Perumahan Karya Hunian, Cikampek","city":"Karawang"}',NULL,NULL,NULL,NULL,2,1792803600000,1792818000000,NULL,'tempo',NULL,NULL);

-- productionOutputs: 2 baris
INSERT INTO "productionOutputs" ("id","productionDate","category","product","spec","quantity","unit","boards","rejects","photoUrl","notes","dutyOfficerName","createdBy","createdAt","updatedAt","issues","batchCode","leader","target","cementBags") VALUES (1,1792544400000,'precast','U-Ditch 40×40','400×400×1200',18,'unit',NULL,1,'/files/production/1790350000001-pr1aaaa1.jpg',NULL,'Satpam Joko',3,1792573200000,1792573200000,'["Cetakan retak"]','PC-261021-01','Pak Mandor Dedi',20,36);
INSERT INTO "productionOutputs" ("id","productionDate","category","product","spec","quantity","unit","boards","rejects","photoUrl","notes","dutyOfficerName","createdBy","createdAt","updatedAt","issues","batchCode","leader","target","cementBags") VALUES (2,1792630800000,'paving','Paving Truepave','6 cm abu',42.5,'m²',85,4,'/files/production/1790350000002-pr2bbbb2.jpg','Lancar',NULL,3,1792659600000,1792659600000,'[]','PV-261022-01',NULL,NULL,NULL);

-- products: 6 baris
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (1,'PVG-0101','Paving Block — Truepave / bata 21 × 10,5 cm','paving','m²',85000,1,1790816400000,1790816400000);
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (2,'KST-0402','Kanstin KS 20','other','buah',15000,1,1790816400000,1790816400000);
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (3,'PVG-X01','Paving Hexagon 20x20 (nama lama)','paving','m²',88000,1,1790816400000,1790816400000);
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (4,'BTK-001','Batako Press 10x20x40','batako','buah',4200,1,1790816400000,1790816400000);
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (5,'GTG-X02','genteng beton garuda','genteng','pcs',4500,1,1790816400000,1790816400000);
INSERT INTO "products" ("id","sku","name","category","unit","defaultPrice","isActive","createdAt","updatedAt") VALUES (6,'OLD-001','Pasir Cor (jasa)','other','m³',NULL,0,1790816400000,1791766800000);

-- publicTrackingLinks: 3 baris
INSERT INTO "publicTrackingLinks" ("id","deliveryId","tokenHash","expiresAt","isRevoked","lastAccessedAt","createdAt","updatedAt") VALUES (1,4,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',1793408400000,0,1792810800000,1792803600000,1792810800000);
INSERT INTO "publicTrackingLinks" ("id","deliveryId","tokenHash","expiresAt","isRevoked","lastAccessedAt","createdAt","updatedAt") VALUES (2,6,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',1792425600000,0,NULL,1792285200000,1792285200000);
INSERT INTO "publicTrackingLinks" ("id","deliveryId","tokenHash","expiresAt","isRevoked","lastAccessedAt","createdAt","updatedAt") VALUES (3,5,'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',NULL,1,1792893600000,1792890000000,1792893600000);

-- pushSubscriptions: 1 baris
INSERT INTO "pushSubscriptions" ("id","userId","endpoint","p256dh","auth","userAgent","createdAt","updatedAt") VALUES (1,1,'https://push.example.test/sub/fixture-1','p256dh-fixture','auth-fixture','Chrome',1791594000000,1791594000000);

-- qualityControlNotifications: 2 baris
INSERT INTO "qualityControlNotifications" ("id","orderId","type","title","message","readAt","createdAt") VALUES (1,3,'new_order','Order baru','PO/2610/0003 perlu disiapkan',NULL,1792544400000);
INSERT INTO "qualityControlNotifications" ("id","orderId","type","title","message","readAt","createdAt") VALUES (2,4,'loaded','Sudah dimuat','PO/2610/0004 siap kirim',1792634400000,1792630800000);

-- sandTests: 3 baris
INSERT INTO "sandTests" ("id","receiptId","status","testedAt","completedAt","supplier","quarry","sandType","readingUnit","sandHeightCm","siltHeightCm","siltPercent","maxSiltPercent","decision","startPhotoUrl","photoUrl","notes","dutyOfficerName","completedByName","createdBy","completedBy","createdAt") VALUES (1,1,'selesai',1791770400000,1791777600000,'CV Pasir Jaya','Galian Cikao','Pasir Cor','cm',18.5,1.2,6.1,10,'diterima','/files/sand-tests/1790330000001-sd1aaaa1.jpg','/files/sand-tests/1790330000002-sd1bbbb2.jpg',NULL,'Satpam Joko','Rina Lab',4,8,1791770400000);
INSERT INTO "sandTests" ("id","receiptId","status","testedAt","completedAt","supplier","quarry","sandType","readingUnit","sandHeightCm","siltHeightCm","siltPercent","maxSiltPercent","decision","startPhotoUrl","photoUrl","notes","dutyOfficerName","completedByName","createdBy","completedBy","createdAt") VALUES (2,3,'selesai',1792112400000,1792119600000,'CV Pasir Jaya',NULL,'Pasir Urug','ml',100,22,22,10,'ditolak',NULL,'/files/sand-tests/1790340000001-sd2cccc3.jpg','Lumpur tinggi',NULL,'Rina Lab',4,8,1792112400000);
INSERT INTO "sandTests" ("id","receiptId","status","testedAt","completedAt","supplier","quarry","sandType","readingUnit","sandHeightCm","siltHeightCm","siltPercent","maxSiltPercent","decision","startPhotoUrl","photoUrl","notes","dutyOfficerName","completedByName","createdBy","completedBy","createdAt") VALUES (3,NULL,'draft',1792890000000,NULL,NULL,NULL,'Pasir Halus','cm',NULL,NULL,NULL,10,NULL,NULL,NULL,NULL,'Satpam Gerbang',NULL,4,NULL,1792890000000);

-- sessions: 0 baris

-- strengthTestSamples: 3 baris
INSERT INTO "strengthTestSamples" ("id","testId","position","sampleName","madeAt","testedAt","weightKg","areaCm2","maxLoadKn") VALUES (1,1,1,'A-1',1790816400000,1791421200000,8.4,225,720.5);
INSERT INTO "strengthTestSamples" ("id","testId","position","sampleName","madeAt","testedAt","weightKg","areaCm2","maxLoadKn") VALUES (2,1,2,'A-2',1790816400000,1791421200000,8.38,225,705);
INSERT INTO "strengthTestSamples" ("id","testId","position","sampleName","madeAt","testedAt","weightKg","areaCm2","maxLoadKn") VALUES (3,1,3,'A-3',1790816400000,NULL,NULL,NULL,NULL);

-- strengthTests: 1 baris
INSERT INTO "strengthTests" ("id","reportDate","companyName","address","concreteGrade","addressedTo","composition","notes","createdBy","labSignedBy","labSignedAt","leaderSignedBy","leaderSignedAt","createdAt","updatedAt","reviewStatus","reviewNote") VALUES (1,1792026000000,'PT Istana Block','Purwakarta','K-300','Kontraktor X','[{"name":"Semen","qty":350,"unit":"kg/m³"},{"name":"Air","qty":175,"unit":"l/m³"}]',NULL,8,7,1792051200000,7,1792054800000,1792026000000,1792054800000,'disetujui',NULL);

-- users: 9 baris
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (1,'Siti Customer Service','cs',NULL,'pemilik@uji.local','superadmin','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,1792893600000,1790816400000,1790816400000,0,1,1,0,0,NULL,1,1);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (2,'Admin Kantor','admin.kantor',NULL,'admin@istana.test','admin','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790816400000,1790816400000,0,1,0,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (3,'Pak Mandor Dedi','mandor',NULL,NULL,'mandor','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790816400000,1790816400000,0,0,0,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (4,'Satpam Gerbang','satpam',NULL,NULL,'satpam','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790816400000,1790816400000,0,0,0,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (5,'Asep Saepudin',NULL,'08110000 4101',NULL,'driver','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790902800000,1790902800000,0,0,0,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (6,'Ujang Kurnia',NULL,'+62 811-0000-4102',NULL,'driver','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790902800000,1790902800000,0,0,0,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (7,'Lukman QC','lukman',NULL,'lukman@istana.test','qc','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790902800000,1790902800000,0,0,1,1,1,'/files/signatures/7-1790400000001-sig7ab.png',1,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (8,'Rina Lab','rina',NULL,'rina@istana.test','qc','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',1,0,NULL,NULL,1790902800000,1790902800000,0,0,1,0,0,NULL,0,0);
INSERT INTO "users" ("id","name","username","phone","email","role","passwordHash","isActive","failedAttempts","lockedUntil","lastSignedIn","createdAt","updatedAt","mustChangePassword","canCompleteOrders","canViewSandTests","canApproveQc","canSignAsLeader","signatureUrl","canRatePrice","canViewSummary") VALUES (9,'Bu O''Neil (akun nonaktif)','admin.lama',NULL,'ADMIN@istana.test','admin','pbkdf2$100000$c2FsdC1maXh0dXJl$ZmFrZS1oYXNoLWZpeHR1cmUtdGlkYWstdmFsaWQ=',0,5,1792458000000,NULL,1790816400000,1792026000000,1,0,0,0,0,NULL,0,0);

-- vehicles: 4 baris
INSERT INTO "vehicles" ("id","plateNumber","vehicleType","capacityNote","stnkExpiryDate","kirExpiryDate","isActive","createdAt","updatedAt") VALUES (1,'T 8417 BD','Truk engkel','± 7 ton',1808096400000,NULL,1,1790902800000,1790902800000);
INSERT INTO "vehicles" ("id","plateNumber","vehicleType","capacityNote","stnkExpiryDate","kirExpiryDate","isActive","createdAt","updatedAt") VALUES (2,'T8593BC','Truk engkel',NULL,NULL,NULL,1,1790902800000,1790902800000);
INSERT INTO "vehicles" ("id","plateNumber","vehicleType","capacityNote","stnkExpiryDate","kirExpiryDate","isActive","createdAt","updatedAt") VALUES (3,'t 9125 ab','Colt diesel','± 4,5 ton',NULL,NULL,1,1790902800000,1790902800000);
INSERT INTO "vehicles" ("id","plateNumber","vehicleType","capacityNote","stnkExpiryDate","kirExpiryDate","isActive","createdAt","updatedAt") VALUES (4,'T 1234 ZZ','Pickup',NULL,NULL,NULL,0,1790902800000,1791853200000);

CREATE INDEX `activity_logs_at_idx` ON `activityLogs` (`at`);
CREATE INDEX `activity_logs_user_idx` ON `activityLogs` (`userId`,`at`);
CREATE INDEX `addresses_customer_idx` ON `customerAddresses` (`customerId`);
CREATE INDEX `backup_runs_at_idx` ON `backupRuns` (`at`);
CREATE INDEX `calendar_events_series_idx` ON `calendarEvents` (`seriesId`);
CREATE INDEX `calendar_events_start_idx` ON `calendarEvents` (`startAt`);
CREATE UNIQUE INDEX `calendar_participants_idx` ON `calendarParticipants` (`eventId`,`userId`);
CREATE INDEX `calendar_participants_user_idx` ON `calendarParticipants` (`userId`);
CREATE INDEX `calendar_reminders_due_idx` ON `calendarReminders` (`sentAt`,`remindAt`);
CREATE INDEX `calendar_reminders_event_idx` ON `calendarReminders` (`eventId`);
CREATE UNIQUE INDEX `calendar_results_event_idx` ON `calendarResults` (`eventId`);
CREATE INDEX `customers_name_idx` ON `customers` (`name`);
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);
CREATE INDEX `deliveries_driver_status_idx` ON `deliveries` (`driverId`,`status`);
CREATE UNIQUE INDEX `deliveries_order_idx` ON `deliveries` (`orderId`);
CREATE INDEX `delivery_notifications_delivery_idx` ON `deliveryNotifications` (`deliveryId`);
CREATE INDEX `delivery_notifications_read_idx` ON `deliveryNotifications` (`readAt`,`createdAt`);
CREATE INDEX `delivery_proofs_delivery_idx` ON `deliveryProofs` (`deliveryId`);
CREATE INDEX `driver_locations_delivery_time_idx` ON `driverLocations` (`deliveryId`,`recordedAt`);
CREATE INDEX `drivers_name_idx` ON `drivers` (`name`);
CREATE INDEX `drivers_user_idx` ON `drivers` (`userId`);
CREATE INDEX `duty_officers_account_idx` ON `dutyOfficers` (`accountUserId`);
CREATE INDEX `duty_shifts_account_idx` ON `dutyShifts` (`accountUserId`,`endedAt`);
CREATE INDEX `duty_shifts_started_idx` ON `dutyShifts` (`startedAt`);
CREATE INDEX `goods_receipts_date_idx` ON `goodsReceipts` (`receivedAt`);
CREATE INDEX `goods_receipts_item_idx` ON `goodsReceipts` (`itemName`);
CREATE INDEX `iso_records_form_date_idx` ON `isoRecords` (`formCode`,`kind`,`recordDate`);
CREATE UNIQUE INDEX `iso_records_source_idx` ON `isoRecords` (`formCode`,`sourceKey`);
CREATE INDEX `mix_designs_status_idx` ON `mixDesigns` (`status`,`layer`);
CREATE INDEX `mix_logs_date_idx` ON `mixDesignLogs` (`workDate`,`layer`);
CREATE INDEX `order_deletion_audit_date_idx` ON `orderDeletionAudit` (`deletedAt`);
CREATE INDEX `order_deletion_audit_po_idx` ON `orderDeletionAudit` (`poNumber`);
CREATE INDEX `order_items_order_idx` ON `orderItems` (`orderId`);
CREATE INDEX `orders_customer_idx` ON `orders` (`customerId`);
CREATE INDEX `orders_external_ref_idx` ON `orders` (`externalRef`);
CREATE UNIQUE INDEX `orders_po_number_idx` ON `orders` (`poNumber`);
CREATE INDEX `orders_status_date_idx` ON `orders` (`status`,`requestedDeliveryDate`);
CREATE INDEX `production_outputs_category_idx` ON `productionOutputs` (`category`,`product`);
CREATE INDEX `production_outputs_date_idx` ON `productionOutputs` (`productionDate`);
CREATE UNIQUE INDEX `products_sku_idx` ON `products` (`sku`);
CREATE UNIQUE INDEX `push_endpoint_idx` ON `pushSubscriptions` (`endpoint`);
CREATE INDEX `push_user_idx` ON `pushSubscriptions` (`userId`);
CREATE INDEX `qc_notifications_order_idx` ON `qualityControlNotifications` (`orderId`);
CREATE INDEX `qc_notifications_read_idx` ON `qualityControlNotifications` (`readAt`,`createdAt`);
CREATE INDEX `sand_tests_date_idx` ON `sandTests` (`testedAt`);
CREATE INDEX `sand_tests_receipt_idx` ON `sandTests` (`receiptId`);
CREATE INDEX `sand_tests_status_idx` ON `sandTests` (`status`);
CREATE UNIQUE INDEX `sessions_token_idx` ON `sessions` (`tokenHash`);
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);
CREATE INDEX `status_history_delivery_idx` ON `deliveryStatusHistory` (`deliveryId`,`createdAt`);
CREATE INDEX `strength_samples_test_idx` ON `strengthTestSamples` (`testId`);
CREATE INDEX `strength_tests_date_idx` ON `strengthTests` (`reportDate`);
CREATE INDEX `tracking_delivery_idx` ON `publicTrackingLinks` (`deliveryId`);
CREATE UNIQUE INDEX `tracking_token_idx` ON `publicTrackingLinks` (`tokenHash`);
CREATE UNIQUE INDEX `users_phone_idx` ON `users` (`phone`);
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);
CREATE UNIQUE INDEX `vehicles_plate_idx` ON `vehicles` (`plateNumber`);
