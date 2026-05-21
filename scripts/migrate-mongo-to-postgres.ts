import { MongoClient, ObjectId, type Db } from "mongodb";
import {
  PrismaClient,
  type ServicePartnerStatus,
  type UserType,
  type ClientUserType,
  type ServiceWorkflowStatus,
  type TaskStatus,
  type PaymentStatus,
  type InventoryRequestStatus,
  type InventoryRecordType,
  type InventoryTxnType,
  type SupplierType,
  type LegalStatus,
  type DealingIn,
  type ApprovalStatus,
  type InvoicePaidStatus,
  type RfqStatus,
  type RfqVendorStatus,
  type VendorDocumentType,
} from "@prisma/client";

let prisma = new PrismaClient();

const mongoUrl = process.env.MONGODB_SOURCE_URL;
const mongoDbName = process.env.MONGODB_SOURCE_DB ?? "dev_matrix";

if (!mongoUrl) {
  throw new Error("Missing MONGODB_SOURCE_URL in environment");
}
const resolvedMongoUrl: string = mongoUrl;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryablePrismaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "").toLowerCase();
  if (code === "P1017" || code === "P1001" || code === "P1002" || code === "P2024") return true;
  return (
    message.includes("server has closed the connection") ||
    message.includes("connection") ||
    message.includes("timed out")
  );
}

async function runWithRetry<T>(
  label: string,
  operation: () => Promise<T>,
  maxAttempts = 5
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryablePrismaError(error) || attempt >= maxAttempts) {
        throw error;
      }
      const waitMs = attempt * 1000;
      console.warn(
        `[retry ${attempt}/${maxAttempts}] ${label} failed due to transient DB error. Retrying in ${waitMs}ms...`
      );
      try {
        await prisma.$disconnect();
      } catch {
        // ignore disconnect error on retry path
      }
      prisma = new PrismaClient();
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [values];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function toId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string") return value;
  return undefined;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry)).filter((entry) => entry.length > 0);
}

function mapServicePartnerStatus(value: unknown): ServicePartnerStatus {
  const status = String(value ?? "Pending").toUpperCase();
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  return "PENDING";
}

function mapUserType(value: unknown): UserType {
  const normalized = String(value ?? "servicePartnerUser").toLowerCase();
  return normalized === "admin" ? "ADMIN" : "SERVICE_PARTNER_USER";
}

function mapClientUserType(value: unknown): ClientUserType {
  const normalized = String(value ?? "clientUser").toLowerCase();
  return normalized === "admin" ? "ADMIN" : "CLIENT_USER";
}

function mapServiceStatus(value: unknown): ServiceWorkflowStatus {
  const raw = String(value ?? "Pending");
  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  const allowed: ServiceWorkflowStatus[] = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "REVISE",
    "UPDATED",
    "ASSIGNED",
    "COMPLETED",
    "APPROVAL_PENDING",
    "WORK_IN_PROGRESS",
  ];
  return allowed.includes(normalized as ServiceWorkflowStatus)
    ? (normalized as ServiceWorkflowStatus)
    : "PENDING";
}

function mapTaskStatus(value: unknown): TaskStatus {
  const normalized = String(value ?? "Yet to start").toLowerCase().trim();
  if (normalized === "completed") return "COMPLETED";
  if (normalized === "in progress" || normalized === "in_progress") return "IN_PROGRESS";
  return "YET_TO_START";
}

function mapPaymentStatus(value: unknown): PaymentStatus {
  const normalized = String(value ?? "Requested").toUpperCase().trim();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PAID") return "PAID";
  if (normalized === "SUBMITTED") return "SUBMITTED";
  return "REQUESTED";
}

function mapInventoryRequestStatus(value: unknown): InventoryRequestStatus {
  const normalized = String(value ?? "Pending").toUpperCase().trim();
  if (normalized === "FULFILLED") return "FULFILLED";
  if (normalized === "REJECTED") return "REJECTED";
  return "PENDING";
}

function mapInventoryRecordType(value: unknown): InventoryRecordType | null {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "inventory_in") return "INVENTORY_IN";
  if (normalized === "inventory_out") return "INVENTORY_OUT";
  return null;
}

function mapInventoryTxnType(value: unknown): InventoryTxnType | null {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "purchase") return "PURCHASE";
  if (normalized === "return") return "RETURN";
  if (normalized === "issued") return "ISSUED";
  return null;
}

function mapSupplierType(value: unknown): SupplierType | null {
  const normalized = String(value ?? "").toUpperCase().trim();
  if (normalized === "SUPPLIER") return "SUPPLIER";
  if (normalized === "CONTRACTOR") return "CONTRACTOR";
  return null;
}

function mapLegalStatus(value: unknown): LegalStatus | null {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "sole_proprietorship") return "SOLE_PROPRIETORSHIP";
  if (normalized === "private_limited") return "PRIVATE_LIMITED";
  if (normalized === "public_limited") return "PUBLIC_LIMITED";
  if (normalized === "partnership") return "PARTNERSHIP";
  if (normalized === "llp") return "LLP";
  return null;
}

function mapDealingIn(value: unknown): DealingIn[] {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((entry) => String(entry ?? "").toLowerCase().trim())
    .map((entry) => {
      if (entry === "plumbing") return "PLUMBING";
      if (entry === "electrician") return "ELECTRICIAN";
      if (entry === "carpenter") return "CARPENTER";
      return "OTHER";
    });
  return Array.from(new Set(mapped)) as DealingIn[];
}

function mapApprovalStatus(value: unknown): ApprovalStatus {
  const normalized = String(value ?? "Pending").toUpperCase().trim();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "REJECTED") return "REJECTED";
  return "PENDING";
}

function mapInvoicePaidStatus(value: unknown): InvoicePaidStatus {
  const normalized = String(value ?? "Pending").toUpperCase().trim();
  return normalized === "PAID" ? "PAID" : "PENDING";
}

function mapRfqStatus(value: unknown): RfqStatus {
  const normalized = String(value ?? "DRAFT").toUpperCase().trim();
  const allowed: RfqStatus[] = ["DRAFT", "SENT", "RESPONDED", "APPROVED", "ACCEPTED", "REJECTED"];
  return allowed.includes(normalized as RfqStatus) ? (normalized as RfqStatus) : "DRAFT";
}

function mapRfqVendorStatus(value: unknown): RfqVendorStatus {
  const normalized = String(value ?? "PENDING").toUpperCase().trim();
  const allowed: RfqVendorStatus[] = [
    "PENDING",
    "VIEWED",
    "RESPONDED",
    "APPROVED",
    "ACCEPTED",
    "REJECTED",
  ];
  return allowed.includes(normalized as RfqVendorStatus)
    ? (normalized as RfqVendorStatus)
    : "PENDING";
}

function mapVendorDocumentType(value: unknown): VendorDocumentType | null {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "aadhaar") return "AADHAAR";
  if (normalized === "pan") return "PAN";
  if (normalized === "gst") return "GST";
  if (normalized === "license") return "LICENSE";
  if (normalized === "registration_certificate") return "REGISTRATION_CERTIFICATE";
  return null;
}

async function getCollection(db: Db, names: string[]) {
  const existing = await db.listCollections().toArray();
  const existingNames = new Set(existing.map((c) => c.name));
  const selected = names.find((name) => existingNames.has(name));
  if (!selected) return null;
  return db.collection(selected);
}

async function migrateServicePartners(db: Db) {
  const collection = await getCollection(db, ["servicepartners", "servicepartnerss", "servicePartners"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating service partners: ${docs.length}`);

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    await prisma.servicePartner.upsert({
      where: { id },
      update: {
        companyName: String(doc.company_name ?? ""),
        name: String(doc.name ?? ""),
        email: String(doc.email ?? `${id}@unknown.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
        address: doc.address ? String(doc.address) : null,
        status: mapServicePartnerStatus(doc.status),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        companyName: String(doc.company_name ?? ""),
        name: String(doc.name ?? ""),
        email: String(doc.email ?? `${id}@unknown.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
        address: doc.address ? String(doc.address) : null,
        status: mapServicePartnerStatus(doc.status),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateRoles(db: Db) {
  const collection = await getCollection(db, ["roles"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating roles: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    const servicePartnerId = toId(doc.servicePartnerId);
    if (!id || !servicePartnerId || !servicePartnerIds.has(servicePartnerId)) continue;

    await prisma.role.upsert({
      where: { id },
      update: {
        name: String(doc.name ?? "unknown"),
        permissions: Array.isArray(doc.permissions)
          ? doc.permissions.map((p) => String(p))
          : [],
        servicePartnerId,
      },
      create: {
        id,
        name: String(doc.name ?? "unknown"),
        permissions: Array.isArray(doc.permissions)
          ? doc.permissions.map((p) => String(p))
          : [],
        servicePartnerId,
      },
    });
  }
}

async function migrateUsers(db: Db) {
  const collection = await getCollection(db, ["users"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating users: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const roleIds = new Set((await prisma.role.findMany({ select: { id: true } })).map((row) => row.id));
  const fallbackServicePartnerId = servicePartnerIds.values().next().value as string | undefined;

  for (const doc of docs) {
    const id = toId(doc._id);
    const rawServicePartnerId = toId(doc.servicePartnerId);
    const servicePartnerId =
      rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId)
        ? rawServicePartnerId
        : fallbackServicePartnerId;
    if (!id || !servicePartnerId) continue;
    const roleId = toId(doc.role);
    const validRoleId = roleId && roleIds.has(roleId) ? roleId : null;

    await prisma.user.upsert({
      where: { id },
      update: {
        name: String(doc.name ?? "unknown"),
        email: String(doc.email ?? `${id}@unknown.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        roleId: validRoleId,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        servicePartnerId,
        userType: mapUserType(doc.userType),
      },
      create: {
        id,
        name: String(doc.name ?? "unknown"),
        email: String(doc.email ?? `${id}@unknown.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        roleId: validRoleId,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        servicePartnerId,
        userType: mapUserType(doc.userType),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateClients(db: Db) {
  const collection = await getCollection(db, ["clients"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating clients: ${docs.length}`);

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    await prisma.client.upsert({
      where: { id },
      update: {
        clientName: String(doc.client_name ?? `client-${id.slice(0, 6)}`),
        code: String(doc.code ?? id.slice(0, 8)),
        clientAddress: doc.client_address ? String(doc.client_address) : null,
        email: String(doc.email ?? `${id}@client.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
      },
      create: {
        id,
        clientName: String(doc.client_name ?? `client-${id.slice(0, 6)}`),
        code: String(doc.code ?? id.slice(0, 8)),
        clientAddress: doc.client_address ? String(doc.client_address) : null,
        email: String(doc.email ?? `${id}@client.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateClientUsers(db: Db) {
  const collection = await getCollection(db, ["clientusers", "clientUsers"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating client users: ${docs.length}`);
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const clientId = toId(doc.clientId);
    const validClientId = clientId && clientIds.has(clientId) ? clientId : null;

    await prisma.clientUser.upsert({
      where: { id },
      update: {
        name: String(doc.name ?? "unknown"),
        email: String(doc.email ?? `${id}@client-user.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        userType: mapClientUserType(doc.user_type ?? doc.userType),
        designation: doc.designation ? String(doc.designation) : null,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        reportingToId: null,
        clientId: validClientId,
      },
      create: {
        id,
        name: String(doc.name ?? "unknown"),
        email: String(doc.email ?? `${id}@client-user.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        userType: mapClientUserType(doc.user_type ?? doc.userType),
        designation: doc.designation ? String(doc.designation) : null,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        reportingToId: null,
        clientId: validClientId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }

  const clientUserIds = new Set(
    (await prisma.clientUser.findMany({ select: { id: true } })).map((row) => row.id)
  );
  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const reportingId = toId(doc.reporting_to);
    const reportingToId = reportingId && clientUserIds.has(reportingId) ? reportingId : null;
    if (!reportingToId) continue;
    await prisma.clientUser.update({
      where: { id },
      data: { reportingToId },
    });
  }
}

async function migrateServiceRequests(db: Db) {
  const collection = await getCollection(db, ["servicerequests", "serviceRequests"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating service requests: ${docs.length}`);
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map((row) => row.id));
  const clientUserIds = new Set(
    (await prisma.clientUser.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const branchIds = new Set((await prisma.branch.findMany({ select: { id: true } })).map((row) => row.id));

  let processed = 0;
  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const serviceNumber = String(doc.serviceNumber ?? `SR-MIG-${id.slice(0, 8)}`);
    const rawClientId = toId(doc.clientId);
    const rawClientUserId = toId(doc.clientUserId);
    const rawServicePartnerId = toId(doc.servicePartnerId);
    const rawCreatedBySpUserId = toId(doc.createdByservicePartnerUserId);
    const rawCreatedByClientUserId = toId(doc.createdByclientUserId);
    const rawPmAssignedId = toId(doc.pmAssigned);
    const rawSmAssignedId = toId(doc.smAssigned);
    const rawBranchId = toId(doc.branch_id);
    const clientId = rawClientId && clientIds.has(rawClientId) ? rawClientId : null;
    const clientUserId = rawClientUserId && clientUserIds.has(rawClientUserId) ? rawClientUserId : null;
    const servicePartnerId =
      rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null;
    const createdByServicePartnerUserId =
      rawCreatedBySpUserId && userIds.has(rawCreatedBySpUserId) ? rawCreatedBySpUserId : null;
    const createdByClientUserId =
      rawCreatedByClientUserId && clientUserIds.has(rawCreatedByClientUserId)
        ? rawCreatedByClientUserId
        : null;
    const pmAssignedId = rawPmAssignedId && userIds.has(rawPmAssignedId) ? rawPmAssignedId : null;
    const smAssignedId = rawSmAssignedId && userIds.has(rawSmAssignedId) ? rawSmAssignedId : null;
    const branchId = rawBranchId && branchIds.has(rawBranchId) ? rawBranchId : null;

    await prisma.serviceRequest.upsert({
      where: { id },
      update: {
        title: String(doc.title ?? "Untitled Service Request"),
        serviceType: String(doc.serviceType ?? "General"),
        description: doc.description ? String(doc.description) : null,
        serviceNumber,
        clientId,
        clientUserId,
        servicePartnerId,
        createdByServicePartnerUserId,
        createdByClientUserId,
        callReferenceNumber: doc.call_reference_number
          ? String(doc.call_reference_number)
          : null,
        costName: doc.cost_name ? String(doc.cost_name) : null,
        beforeImages: doc.beforeImages ?? null,
        afterImages: doc.afterImages ?? null,
        pmAssignedId,
        pmAssignedStatus: mapServiceStatus(doc.pmAssignedStatus),
        smAssignedId,
        smAssignedStatus: mapServiceStatus(doc.smAssignedStatus),
        branchId,
        quotationCreatedStatus: mapServiceStatus(doc.quotationCreatedStatus),
        quotationApprovalStatus: mapServiceStatus(doc.quotationApprovalStatus),
        taskCompletionStatus: mapServiceStatus(doc.taskCompletionStatus),
        callDateTime: toDate(doc.call_date_time) ?? null,
        quotationUpdatedAt: toDate(doc.quotationUpdatedAt) ?? null,
        serviceCreatedDate: toDate(doc.serviceCreatedDate) ?? null,
        approveQuotationDate: toDate(doc.approveQuotationDate) ?? null,
        serviceRequestedDate: toDate(doc.serviceRequestedDate) ?? null,
      },
      create: {
        id,
        title: String(doc.title ?? "Untitled Service Request"),
        serviceType: String(doc.serviceType ?? "General"),
        description: doc.description ? String(doc.description) : null,
        serviceNumber,
        clientId,
        clientUserId,
        servicePartnerId,
        createdByServicePartnerUserId,
        createdByClientUserId,
        callReferenceNumber: doc.call_reference_number
          ? String(doc.call_reference_number)
          : null,
        costName: doc.cost_name ? String(doc.cost_name) : null,
        beforeImages: doc.beforeImages ?? null,
        afterImages: doc.afterImages ?? null,
        pmAssignedId,
        pmAssignedStatus: mapServiceStatus(doc.pmAssignedStatus),
        smAssignedId,
        smAssignedStatus: mapServiceStatus(doc.smAssignedStatus),
        branchId,
        quotationCreatedStatus: mapServiceStatus(doc.quotationCreatedStatus),
        quotationApprovalStatus: mapServiceStatus(doc.quotationApprovalStatus),
        taskCompletionStatus: mapServiceStatus(doc.taskCompletionStatus),
        callDateTime: toDate(doc.call_date_time) ?? null,
        quotationUpdatedAt: toDate(doc.quotationUpdatedAt) ?? null,
        serviceCreatedDate: toDate(doc.serviceCreatedDate) ?? null,
        approveQuotationDate: toDate(doc.approveQuotationDate) ?? null,
        serviceRequestedDate: toDate(doc.serviceRequestedDate) ?? null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
    processed += 1;
    if (processed % 250 === 0) {
      console.log(`Service requests migrated: ${processed}/${docs.length}`);
    }
  }
}

async function migrateBranches(db: Db) {
  const collection = await getCollection(db, ["branches"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating branches: ${docs.length}`);
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const clientId = toId(doc.clientId);
    if (!id || !clientId || !clientIds.has(clientId)) continue;
    await prisma.branch.upsert({
      where: { id },
      update: {
        name: String(doc.name ?? "Unknown Branch"),
        address: doc.address ? String(doc.address) : null,
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
        clientId,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        name: String(doc.name ?? "Unknown Branch"),
        address: doc.address ? String(doc.address) : null,
        city: String(doc.city ?? "unknown"),
        state: String(doc.state ?? "unknown"),
        clientId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateCategories(db: Db) {
  const collection = await getCollection(db, ["categories"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating categories: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    const servicePartnerId = toId(doc.servicePartnerId);
    const categoryName = String(doc.category_name ?? "General").trim();
    if (!id || !servicePartnerId || !categoryName || !servicePartnerIds.has(servicePartnerId)) continue;

    await prisma.category.upsert({
      where: {
        servicePartnerId_categoryName: {
          servicePartnerId,
          categoryName,
        },
      },
      update: {
        description: doc.description ? String(doc.description) : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        categoryName,
        description: doc.description ? String(doc.description) : null,
        servicePartnerId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateClientServicePartners(db: Db) {
  const collection = await getCollection(db, ["clientservicepartners", "clientServicePartners"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating client-service-partners: ${docs.length}`);
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map((row) => row.id));
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    const clientId = toId(doc.clientId);
    const servicePartnerId = toId(doc.servicePartnerId);
    if (!id || !clientId || !servicePartnerId) continue;
    if (!clientIds.has(clientId) || !servicePartnerIds.has(servicePartnerId)) continue;

    await prisma.clientServicePartner.upsert({
      where: {
        clientId_servicePartnerId: {
          clientId,
          servicePartnerId,
        },
      },
      update: { updatedAt: toDate(doc.updatedAt) ?? new Date() },
      create: {
        id,
        clientId,
        servicePartnerId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateSuppliers(db: Db) {
  const collection = await getCollection(db, ["suppliers"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating suppliers: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const existingSuppliers = await prisma.supplier.findMany({
    select: { id: true, email: true, mobile: true, supplierCode: true },
  });
  const usedEmails = new Map<string, string>(
    existingSuppliers
      .filter((row) => row.email)
      .map((row) => [String(row.email).toLowerCase(), row.id])
  );
  const usedMobiles = new Map<string, string>(
    existingSuppliers
      .filter((row) => row.mobile)
      .map((row) => [String(row.mobile), row.id])
  );
  const usedCodes = new Map<string, string>(
    existingSuppliers
      .filter((row) => row.supplierCode)
      .map((row) => [String(row.supplierCode), row.id])
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;

    const rawServicePartnerId = toId(doc.servicePartnerId);
    const rawApprovedBy = toId(doc.approvedBy);
    const rawReferredBy = toId(doc.refferredBy);
    const rawEmail = doc.email ? String(doc.email).toLowerCase() : null;
    const rawMobile = doc.mobile ? String(doc.mobile) : null;
    const rawCode = doc.supplier_code ? String(doc.supplier_code) : null;
    const emailOwner = rawEmail ? usedEmails.get(rawEmail) : undefined;
    const mobileOwner = rawMobile ? usedMobiles.get(rawMobile) : undefined;
    const codeOwner = rawCode ? usedCodes.get(rawCode) : undefined;
    const normalizedEmail = rawEmail && (!emailOwner || emailOwner === id) ? rawEmail : null;
    const normalizedMobile = rawMobile && (!mobileOwner || mobileOwner === id) ? rawMobile : null;
    const normalizedCode = rawCode && (!codeOwner || codeOwner === id) ? rawCode : null;

    if (normalizedEmail) usedEmails.set(normalizedEmail, id);
    if (normalizedMobile) usedMobiles.set(normalizedMobile, id);
    if (normalizedCode) usedCodes.set(normalizedCode, id);

    await prisma.supplier.upsert({
      where: { id },
      update: {
        type: mapSupplierType(doc.type),
        name: String(doc.name ?? `supplier-${id.slice(0, 6)}`),
        email: normalizedEmail,
        mobile: normalizedMobile,
        supplierCode: normalizedCode,
        gstNumber: doc.gst_number ? String(doc.gst_number) : null,
        contactName: doc.contact_name ? String(doc.contact_name) : null,
        ifscCode: doc.ifsc_code ? String(doc.ifsc_code) : null,
        state: doc.state ? String(doc.state) : null,
        city: doc.city ? String(doc.city) : null,
        address: doc.address ? String(doc.address) : null,
        documents: doc.documents ?? null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        isVendor: Boolean(doc.isVendor ?? true),
        isVerified: Boolean(doc.isVerified ?? false),
        legalStatus: mapLegalStatus(doc.legalStatus),
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        companyName: doc.companyName ? String(doc.companyName) : null,
        approvedById: rawApprovedBy && userIds.has(rawApprovedBy) ? rawApprovedBy : null,
        referredById: rawReferredBy && userIds.has(rawReferredBy) ? rawReferredBy : null,
        bankName: doc.bank_name ? String(doc.bank_name) : null,
        accountNumber: doc.account_number ? String(doc.account_number) : null,
        dealingIn: mapDealingIn(doc.dealingIn),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        type: mapSupplierType(doc.type),
        name: String(doc.name ?? `supplier-${id.slice(0, 6)}`),
        email: normalizedEmail,
        mobile: normalizedMobile,
        supplierCode: normalizedCode,
        gstNumber: doc.gst_number ? String(doc.gst_number) : null,
        contactName: doc.contact_name ? String(doc.contact_name) : null,
        ifscCode: doc.ifsc_code ? String(doc.ifsc_code) : null,
        state: doc.state ? String(doc.state) : null,
        city: doc.city ? String(doc.city) : null,
        address: doc.address ? String(doc.address) : null,
        documents: doc.documents ?? null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        isVendor: Boolean(doc.isVendor ?? true),
        isVerified: Boolean(doc.isVerified ?? false),
        legalStatus: mapLegalStatus(doc.legalStatus),
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        companyName: doc.companyName ? String(doc.companyName) : null,
        approvedById: rawApprovedBy && userIds.has(rawApprovedBy) ? rawApprovedBy : null,
        referredById: rawReferredBy && userIds.has(rawReferredBy) ? rawReferredBy : null,
        bankName: doc.bank_name ? String(doc.bank_name) : null,
        accountNumber: doc.account_number ? String(doc.account_number) : null,
        dealingIn: mapDealingIn(doc.dealingIn),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateItems(db: Db) {
  const collection = await getCollection(db, ["items"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating items: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );

  let processed = 0;
  for (const doc of docs) {
    const id = toId(doc._id);
    const servicePartnerId = toId(doc.servicePartnerId);
    if (!id || !servicePartnerId || !servicePartnerIds.has(servicePartnerId)) continue;

    await prisma.item.upsert({
      where: { id },
      update: {
        servicePartnerId,
        itemName: String(doc.itemName ?? `item-${id.slice(0, 6)}`),
        additionalDescription: doc.additional_description ? String(doc.additional_description) : null,
        category: doc.category ? String(doc.category) : null,
        hsnCode: doc.hsnCode ? String(doc.hsnCode) : null,
        gstPercentage: toNumber(doc.gstPercentage) ?? null,
        unit: doc.unit ? String(doc.unit) : null,
        remarks: doc.remarks ? String(doc.remarks) : null,
        inventoryType: doc.inventoryType ? String(doc.inventoryType) : null,
        qty: toNumber(doc.qty) ?? null,
        usedQty: toNumber(doc.usedqty) ?? 0,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        servicePartnerId,
        itemName: String(doc.itemName ?? `item-${id.slice(0, 6)}`),
        additionalDescription: doc.additional_description ? String(doc.additional_description) : null,
        category: doc.category ? String(doc.category) : null,
        hsnCode: doc.hsnCode ? String(doc.hsnCode) : null,
        gstPercentage: toNumber(doc.gstPercentage) ?? null,
        unit: doc.unit ? String(doc.unit) : null,
        remarks: doc.remarks ? String(doc.remarks) : null,
        inventoryType: doc.inventoryType ? String(doc.inventoryType) : null,
        qty: toNumber(doc.qty) ?? null,
        usedQty: toNumber(doc.usedqty) ?? 0,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
    processed += 1;
    if (processed % 500 === 0) {
      console.log(`Items migrated: ${processed}/${docs.length}`);
    }
  }
}

async function migrateRcs(db: Db) {
  const collection = await getCollection(db, ["rcs"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating RCs: ${docs.length}`);
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));
  const clientIds = new Set((await prisma.client.findMany({ select: { id: true } })).map((row) => row.id));
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;

    const rawInventoryId = toId(doc.inventory_id);
    const rawClientId = toId(doc.clientId);
    const rawServicePartnerId = toId(doc.servicePartnerId);

    await prisma.rc.upsert({
      where: { id },
      update: {
        rcNumber: String(doc.rc_number ?? `RC-${id.slice(0, 8)}`),
        inventoryId: rawInventoryId && itemIds.has(rawInventoryId) ? rawInventoryId : null,
        finishedGoods: doc.finished_goods ? String(doc.finished_goods) : null,
        rate: toNumber(doc.rate) ?? 0,
        gstPercentage: toNumber(doc.gstPercentage) ?? 0,
        unit: String(doc.unit ?? "unit"),
        clientId: rawClientId && clientIds.has(rawClientId) ? rawClientId : null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        rcNumber: String(doc.rc_number ?? `RC-${id.slice(0, 8)}`),
        inventoryId: rawInventoryId && itemIds.has(rawInventoryId) ? rawInventoryId : null,
        finishedGoods: doc.finished_goods ? String(doc.finished_goods) : null,
        rate: toNumber(doc.rate) ?? 0,
        gstPercentage: toNumber(doc.gstPercentage) ?? 0,
        unit: String(doc.unit ?? "unit"),
        clientId: rawClientId && clientIds.has(rawClientId) ? rawClientId : null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateOtps(db: Db) {
  const collection = await getCollection(db, ["otps", "otp"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating OTPs: ${docs.length}`);

  for (const doc of docs) {
    const phoneNumber = String(doc.phoneNumber ?? "").trim();
    if (!phoneNumber) continue;

    await prisma.otp.upsert({
      where: { phoneNumber },
      update: {
        otp: doc.otp ? String(doc.otp) : null,
        otpExpires: toDate(doc.otpExpires) ?? null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id: toId(doc._id),
        phoneNumber,
        otp: doc.otp ? String(doc.otp) : null,
        otpExpires: toDate(doc.otpExpires) ?? null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateTasks(db: Db) {
  const collection = await getCollection(db, ["tasks", "Tasks"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating tasks: ${docs.length}`);
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));

  let processed = 0;
  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceRequestId = toId(doc.serviceRequestId);
    if (!id || !serviceRequestId || !serviceRequestIds.has(serviceRequestId)) continue;

    const rawCreatedById = toId(doc.created_by);
    const rawUserId = toId(doc.user_id);
    const createdById = rawCreatedById && userIds.has(rawCreatedById) ? rawCreatedById : null;
    const userId = rawUserId && userIds.has(rawUserId) ? rawUserId : null;
    const taskId = String(doc.TaskId ?? `TASK-MIG-${id.slice(0, 8)}`);

    const task = await prisma.task.upsert({
      where: { taskId },
      update: {
        taskId,
        serviceRequestId,
        createdById,
        userId,
        title: String(doc.title ?? "Untitled Task"),
        fileUrl: toStringList(doc.file_url),
        taskDate: String(doc.task_date ?? ""),
        description: String(doc.description ?? ""),
        status: mapTaskStatus(doc.status),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        taskId,
        serviceRequestId,
        createdById,
        userId,
        title: String(doc.title ?? "Untitled Task"),
        fileUrl: toStringList(doc.file_url),
        taskDate: String(doc.task_date ?? ""),
        description: String(doc.description ?? ""),
        status: mapTaskStatus(doc.status),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      select: { id: true },
    });

    await prisma.taskLog.deleteMany({ where: { taskId: task.id } });
    if (!Array.isArray(doc.logs) || doc.logs.length === 0) continue;

    const logs = doc.logs.map((log: Record<string, unknown>, index: number) => {
      const logId = toId(log._id) ?? `task-log-${id}-${index}`;
      const rawUpdatedById = toId(log.updated_by);
      return {
        id: logId,
        taskId: task.id,
        status: mapTaskStatus(log.status),
        updatedById: rawUpdatedById && userIds.has(rawUpdatedById) ? rawUpdatedById : null,
        timestamp: toDate(log.timestamp) ?? new Date(),
        remarks: log.remarks ? String(log.remarks) : null,
      };
    });
    await prisma.taskLog.createMany({ data: logs, skipDuplicates: true });
    processed += 1;
    if (processed % 250 === 0) {
      console.log(`Tasks migrated: ${processed}/${docs.length}`);
    }
  }
}

async function migrateTimeLogs(db: Db) {
  const collection = await getCollection(db, ["timelogs", "timeLogs"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating time logs: ${docs.length}`);
  const taskIds = new Set((await prisma.task.findMany({ select: { id: true } })).map((row) => row.id));
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));

  let processed = 0;
  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceRequestId = toId(doc.serviceRequestId);
    const punchInTime = toDate(doc.punchInTime);
    if (!id || !serviceRequestId || !punchInTime || !serviceRequestIds.has(serviceRequestId)) continue;

    const rawTaskId = toId(doc.task_id);
    const rawUserId = toId(doc.user_id);

    await prisma.timeLog.upsert({
      where: { id },
      update: {
        taskId: rawTaskId && taskIds.has(rawTaskId) ? rawTaskId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        punchInTime,
        punchOutTime: toDate(doc.punchOutTime) ?? null,
        punchInLocation: doc.punchInLocation ? String(doc.punchInLocation) : null,
        punchOutLocation: doc.punchOutLocation ? String(doc.punchOutLocation) : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        taskId: rawTaskId && taskIds.has(rawTaskId) ? rawTaskId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        punchInTime,
        punchOutTime: toDate(doc.punchOutTime) ?? null,
        punchInLocation: doc.punchInLocation ? String(doc.punchInLocation) : null,
        punchOutLocation: doc.punchOutLocation ? String(doc.punchOutLocation) : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
    processed += 1;
    if (processed % 500 === 0) {
      console.log(`Time logs migrated: ${processed}/${docs.length}`);
    }
  }
}

async function migratePayments(db: Db) {
  const collection = await getCollection(db, ["payments", "Payments"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating payments: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceRequestId = toId(doc.serviceRequestId);
    if (!id || !serviceRequestId || !serviceRequestIds.has(serviceRequestId)) continue;

    const rawServicePartnerId = toId(doc.servicePartnerId);
    const rawUserId = toId(doc.user_id);
    const rawApprovedById = toId(doc.approved_by);
    const rawMarkPaidById = toId(doc.mark_as_paid_by);

    await prisma.payment.upsert({
      where: { id },
      update: {
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        remark: doc.remark ? String(doc.remark) : null,
        desc: String(doc.desc ?? ""),
        paymentStatus: mapPaymentStatus(doc.paymentStatus),
        approvedById: rawApprovedById && userIds.has(rawApprovedById) ? rawApprovedById : null,
        approvedDate: toDate(doc.approved_date) ?? null,
        markAsPaidById: rawMarkPaidById && userIds.has(rawMarkPaidById) ? rawMarkPaidById : null,
        markAsPaidDate: toDate(doc.mark_as_paid_date) ?? null,
        paymentsRemarks: doc.paymentsRemarks ? String(doc.paymentsRemarks) : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        remark: doc.remark ? String(doc.remark) : null,
        desc: String(doc.desc ?? ""),
        paymentStatus: mapPaymentStatus(doc.paymentStatus),
        approvedById: rawApprovedById && userIds.has(rawApprovedById) ? rawApprovedById : null,
        approvedDate: toDate(doc.approved_date) ?? null,
        markAsPaidById: rawMarkPaidById && userIds.has(rawMarkPaidById) ? rawMarkPaidById : null,
        markAsPaidDate: toDate(doc.mark_as_paid_date) ?? null,
        paymentsRemarks: doc.paymentsRemarks ? String(doc.paymentsRemarks) : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateExpenses(db: Db) {
  const collection = await getCollection(db, ["expenses", "Expenses"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating expenses: ${docs.length}`);
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceRequestId = toId(doc.serviceRequestId);
    if (!id || !serviceRequestId || !serviceRequestIds.has(serviceRequestId)) continue;

    const rawServicePartnerId = toId(doc.servicePartnerId);
    const rawUserId = toId(doc.user_id);
    const rawVendorId = toId(doc.vendorId);
    const rawActionById = toId(doc.action_taken_by);
    const normalizedExpenseId = String(doc.expenseId ?? "").trim() || `EXP-${id.slice(0, 8)}`;

    await prisma.expense.upsert({
      where: { expenseId: normalizedExpenseId },
      update: {
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        vendorId: rawVendorId && supplierIds.has(rawVendorId) ? rawVendorId : null,
        billDate: toDate(doc.bill_date) ?? null,
        billNumber: doc.bill_number ? String(doc.bill_number) : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        desc: String(doc.desc ?? ""),
        remark: doc.remark ? String(doc.remark) : null,
        file: doc.file ?? null,
        files: toStringList(doc.files),
        expenseStatus: mapPaymentStatus(doc.expenseStatus),
        actionTakenById: rawActionById && userIds.has(rawActionById) ? rawActionById : null,
        expenseId: normalizedExpenseId,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        serviceRequestId,
        userId: rawUserId && userIds.has(rawUserId) ? rawUserId : null,
        vendorId: rawVendorId && supplierIds.has(rawVendorId) ? rawVendorId : null,
        billDate: toDate(doc.bill_date) ?? null,
        billNumber: doc.bill_number ? String(doc.bill_number) : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        desc: String(doc.desc ?? ""),
        remark: doc.remark ? String(doc.remark) : null,
        file: doc.file ?? null,
        files: toStringList(doc.files),
        expenseStatus: mapPaymentStatus(doc.expenseStatus),
        actionTakenById: rawActionById && userIds.has(rawActionById) ? rawActionById : null,
        expenseId: normalizedExpenseId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateQuotations(db: Db) {
  const collection = await getCollection(db, ["quotations", "quotation"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating quotations: ${docs.length}`);
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const rcIds = new Set((await prisma.rc.findMany({ select: { id: true } })).map((row) => row.id));
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const quotationNumber = String(doc.quotationNumber ?? "").trim();
    const serviceRequestId = toId(doc.serviceRequestId);
    if (!id || !quotationNumber || !serviceRequestId || !serviceRequestIds.has(serviceRequestId)) continue;

    const rawCreatedById = toId(doc.createdBy);

    const quotation = await prisma.quotation.upsert({
      where: { quotationNumber },
      update: {
        serviceRequestId,
        totalAmount: toNumber(doc.total_amount) ?? 0,
        cgst: toNumber(doc.cgst) ?? null,
        sgst: toNumber(doc.sgst) ?? null,
        igst: toNumber(doc.igst) ?? null,
        createdById: rawCreatedById && userIds.has(rawCreatedById) ? rawCreatedById : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        serviceRequestId,
        quotationNumber,
        totalAmount: toNumber(doc.total_amount) ?? 0,
        cgst: toNumber(doc.cgst) ?? null,
        sgst: toNumber(doc.sgst) ?? null,
        igst: toNumber(doc.igst) ?? null,
        createdById: rawCreatedById && userIds.has(rawCreatedById) ? rawCreatedById : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      select: { id: true },
    });

    await prisma.quotationRcItem.deleteMany({ where: { quotationId: quotation.id } });
    await prisma.quotationNonRcItem.deleteMany({ where: { quotationId: quotation.id } });

    if (Array.isArray(doc.rcs) && doc.rcs.length > 0) {
      const rcRows = doc.rcs
        .map((entry: Record<string, unknown>, index: number) => {
          const rcId = toId(entry.rc_id);
          if (!rcId || !rcIds.has(rcId)) return null;
          return {
            id: toId(entry._id) ?? `q-rc-${quotation.id}-${index}`,
            quotationId: quotation.id,
            rcId,
            qty: toNumber(entry.qty) ?? 0,
            usedQty: toNumber(entry.usedQty) ?? 0,
            completionStatus: Boolean(entry.completionStatus ?? false),
            completionDate: toDate(entry.completionDate) ?? null,
            remarks: entry.remarks ? String(entry.remarks) : null,
            rate: toNumber(entry.rate) ?? null,
            additionalDescription: entry.additional_description ? String(entry.additional_description) : null,
          };
        })
        .filter((entry) => Boolean(entry));

      if (rcRows.length > 0) {
        await prisma.quotationRcItem.createMany({ data: rcRows as never[], skipDuplicates: true });
      }
    }

    if (Array.isArray(doc.non_rcs) && doc.non_rcs.length > 0) {
      const nonRcRows = doc.non_rcs
        .map((entry: Record<string, unknown>, index: number) => {
          const inventoryId = toId(entry.inventory_id);
          if (!inventoryId || !itemIds.has(inventoryId)) return null;
          return {
            id: toId(entry._id) ?? `q-item-${quotation.id}-${index}`,
            quotationId: quotation.id,
            inventoryId,
            qty: toNumber(entry.qty) ?? 0,
            usedQty: toNumber(entry.usedQty) ?? 0,
            completionStatus: Boolean(entry.completionStatus ?? false),
            completionDate: toDate(entry.completionDate) ?? null,
            rate: toNumber(entry.rate) ?? null,
            remarks: entry.remarks ? String(entry.remarks) : null,
            additionalDescription: entry.additional_description ? String(entry.additional_description) : null,
          };
        })
        .filter((entry) => Boolean(entry));

      if (nonRcRows.length > 0) {
        await prisma.quotationNonRcItem.createMany({ data: nonRcRows as never[], skipDuplicates: true });
      }
    }
  }
}

async function migrateInventoryRequests(db: Db) {
  const collection = await getCollection(db, ["inventoryrequests", "inventoryRequests"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating inventory requests: ${docs.length}`);
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const rawServiceRequestId = toId(doc.serviceRequestId);
    const rawServicePartnerId = toId(doc.servicePartnerId);
    const rawRequestedById = toId(doc.requestedBy);

    await prisma.inventoryRequest.upsert({
      where: { id },
      update: {
        title: doc.title ? String(doc.title) : null,
        description: doc.description ? String(doc.description) : null,
        serviceRequestId:
          rawServiceRequestId && serviceRequestIds.has(rawServiceRequestId) ? rawServiceRequestId : null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        status: mapInventoryRequestStatus(doc.status),
        requestedById: rawRequestedById && userIds.has(rawRequestedById) ? rawRequestedById : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        title: doc.title ? String(doc.title) : null,
        description: doc.description ? String(doc.description) : null,
        serviceRequestId:
          rawServiceRequestId && serviceRequestIds.has(rawServiceRequestId) ? rawServiceRequestId : null,
        servicePartnerId:
          rawServicePartnerId && servicePartnerIds.has(rawServicePartnerId) ? rawServicePartnerId : null,
        status: mapInventoryRequestStatus(doc.status),
        requestedById: rawRequestedById && userIds.has(rawRequestedById) ? rawRequestedById : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });

    await prisma.inventoryRequestItem.deleteMany({ where: { inventoryRequestId: id } });
    if (!Array.isArray(doc.items) || doc.items.length === 0) continue;

    const rows = doc.items.map((entry: Record<string, unknown>, index: number) => {
      const rawItemId = toId(entry.item);
      return {
        id: toId(entry._id) ?? `inv-req-item-${id}-${index}`,
        inventoryRequestId: id,
        itemId: rawItemId && itemIds.has(rawItemId) ? rawItemId : null,
        itemName: entry.itemName ? String(entry.itemName) : null,
        qty: toNumber(entry.qty) ?? null,
        category: entry.category ? String(entry.category) : null,
        unit: entry.unit ? String(entry.unit) : null,
      };
    });
    await prisma.inventoryRequestItem.createMany({ data: rows, skipDuplicates: true });
  }
}

async function migrateSites(db: Db) {
  const collection = await getCollection(db, ["sites"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating sites: ${docs.length}`);

  for (const doc of docs) {
    const id = toId(doc._id);
    const name = String(doc.name ?? `site-${id ?? "unknown"}`).trim();
    if (!id || !name) continue;

    await prisma.site.upsert({
      where: { name },
      update: {
        inventoryId: toId(doc.inventoryId) ?? null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        name,
        inventoryId: toId(doc.inventoryId) ?? null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateInventories(db: Db) {
  const collection = await getCollection(db, ["inventories", "inventory"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating inventories: ${docs.length}`);
  const inventoryRequestIds = new Set(
    (await prisma.inventoryRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));
  const siteIds = new Set((await prisma.site.findMany({ select: { id: true } })).map((row) => row.id));
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const servicePartnerId = toId(doc.servicePartnerId);
    if (!id || !servicePartnerId || !servicePartnerIds.has(servicePartnerId)) continue;

    const rawInventoryRequestId = toId(doc.inventory_request_id);
    const rawServiceRequestId = toId(doc.service_request);
    const rawReceivedById = toId(doc.received_by);
    const rawPersonNameId = toId(doc.person_name);
    const rawSupplierId = toId(doc.supplier_id);
    const rawSiteId = toId(doc.site);

    await prisma.inventory.upsert({
      where: { id },
      update: {
        inventoryRequestId:
          rawInventoryRequestId && inventoryRequestIds.has(rawInventoryRequestId) ? rawInventoryRequestId : null,
        servicePartnerId,
        recordType: mapInventoryRecordType(doc.record_type),
        inventoryType: mapInventoryTxnType(doc.inventory_type),
        serviceRequestId:
          rawServiceRequestId && serviceRequestIds.has(rawServiceRequestId) ? rawServiceRequestId : null,
        receivedById: rawReceivedById && userIds.has(rawReceivedById) ? rawReceivedById : null,
        isGodown: typeof doc.is_godown === "boolean" ? doc.is_godown : null,
        billNo: doc.bill_no ? String(doc.bill_no) : null,
        billDate: toDate(doc.bill_date) ?? null,
        billAttachment: doc.bill_attachment ? String(doc.bill_attachment) : null,
        personNameId: rawPersonNameId && userIds.has(rawPersonNameId) ? rawPersonNameId : null,
        supplierId: rawSupplierId && supplierIds.has(rawSupplierId) ? rawSupplierId : null,
        inventoryOutDate: toDate(doc.inventory_out_date) ?? null,
        siteId: rawSiteId && siteIds.has(rawSiteId) ? rawSiteId : null,
        siteName: doc.siteName ? String(doc.siteName) : null,
        outerRemarks: doc.outerRemarks ? String(doc.outerRemarks) : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        inventoryRequestId:
          rawInventoryRequestId && inventoryRequestIds.has(rawInventoryRequestId) ? rawInventoryRequestId : null,
        servicePartnerId,
        recordType: mapInventoryRecordType(doc.record_type),
        inventoryType: mapInventoryTxnType(doc.inventory_type),
        serviceRequestId:
          rawServiceRequestId && serviceRequestIds.has(rawServiceRequestId) ? rawServiceRequestId : null,
        receivedById: rawReceivedById && userIds.has(rawReceivedById) ? rawReceivedById : null,
        isGodown: typeof doc.is_godown === "boolean" ? doc.is_godown : null,
        billNo: doc.bill_no ? String(doc.bill_no) : null,
        billDate: toDate(doc.bill_date) ?? null,
        billAttachment: doc.bill_attachment ? String(doc.bill_attachment) : null,
        personNameId: rawPersonNameId && userIds.has(rawPersonNameId) ? rawPersonNameId : null,
        supplierId: rawSupplierId && supplierIds.has(rawSupplierId) ? rawSupplierId : null,
        inventoryOutDate: toDate(doc.inventory_out_date) ?? null,
        siteId: rawSiteId && siteIds.has(rawSiteId) ? rawSiteId : null,
        siteName: doc.siteName ? String(doc.siteName) : null,
        outerRemarks: doc.outerRemarks ? String(doc.outerRemarks) : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });

    await prisma.inventoryItem.deleteMany({ where: { inventoryId: id } });
    if (!Array.isArray(doc.items) || doc.items.length === 0) continue;

    const rows = doc.items
      .map((entry: Record<string, unknown>, index: number) => {
        const rawItemId = toId(entry.inventory_id);
        if (!rawItemId || !itemIds.has(rawItemId)) return null;
        return {
          id: toId(entry._id) ?? `inventory-item-${id}-${index}`,
          inventoryId: id,
          itemId: rawItemId,
          qtyIn: toNumber(entry.qty_in) ?? 0,
          qtyOut: toNumber(entry.qty_out) ?? 0,
          rate: toNumber(entry.rate) ?? 0,
          remarks: entry.remarks ? String(entry.remarks) : null,
        };
      })
      .filter((entry) => Boolean(entry));

    if (rows.length > 0) {
      await prisma.inventoryItem.createMany({ data: rows as never[], skipDuplicates: true });
    }
  }
}

async function migrateAssignServices(db: Db) {
  const collection = await getCollection(db, ["assignservices", "assignServices"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating assign services: ${docs.length}`);
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceId = toId(doc.serviceId);
    if (!id || !serviceId || !serviceRequestIds.has(serviceId)) continue;

    await prisma.assignService.upsert({
      where: { id },
      update: {
        serviceId,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        serviceId,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });

    await prisma.assignServiceInventory.deleteMany({ where: { assignServiceId: id } });
    if (!Array.isArray(doc.inventories) || doc.inventories.length === 0) continue;

    const rows = doc.inventories
      .map((entry: Record<string, unknown>, index: number) => {
        const inventoryItemId = toId(entry.inventory_id);
        if (!inventoryItemId || !itemIds.has(inventoryItemId)) return null;
        return {
          id: toId(entry._id) ?? `assign-service-item-${id}-${index}`,
          assignServiceId: id,
          inventoryItemId,
          qty: toNumber(entry.qty) ?? 0,
          usedQty: toNumber(entry.usedQty) ?? null,
          completionStatus: Boolean(entry.completionStatus ?? false),
          completionDate: toDate(entry.completionDate) ?? null,
        };
      })
      .filter((entry) => Boolean(entry));

    if (rows.length > 0) {
      await prisma.assignServiceInventory.createMany({ data: rows as never[], skipDuplicates: true });
    }
  }
}

async function migratePurchaseOrders(db: Db) {
  const collection = await getCollection(db, ["purchaseorders", "purchaseOrders"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating purchase orders: ${docs.length}`);
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const serviceRequestId = toId(doc.serviceRequestId);
    const createdById = toId(doc.createdBy);
    if (!id || !serviceRequestId || !serviceRequestIds.has(serviceRequestId)) continue;
    if (!createdById || !userIds.has(createdById)) continue;

    const items = Array.isArray(doc.items) ? doc.items : [];
    const totalAmountFromItems = items.reduce((sum: number, item: Record<string, unknown>) => {
      return sum + (toNumber(item.total) ?? 0);
    }, 0);

    const servicePartnerId = toId(doc.servicePartnerId);
    const supplierId = toId(doc.supplierId);

    await prisma.purchaseOrder.upsert({
      where: { id },
      update: {
        poNumber: String(doc.poNumber ?? `PO-MIG-${id.slice(0, 8)}`),
        serviceRequestId,
        servicePartnerId:
          servicePartnerId && servicePartnerIds.has(servicePartnerId) ? servicePartnerId : null,
        totalAmount: toNumber(doc.totalAmount) ?? totalAmountFromItems,
        createdById,
        approvalStatus: mapApprovalStatus(doc.approvalStatus),
        supplierId: supplierId && supplierIds.has(supplierId) ? supplierId : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        poNumber: String(doc.poNumber ?? `PO-MIG-${id.slice(0, 8)}`),
        serviceRequestId,
        servicePartnerId:
          servicePartnerId && servicePartnerIds.has(servicePartnerId) ? servicePartnerId : null,
        totalAmount: toNumber(doc.totalAmount) ?? totalAmountFromItems,
        createdById,
        approvalStatus: mapApprovalStatus(doc.approvalStatus),
        supplierId: supplierId && supplierIds.has(supplierId) ? supplierId : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });

    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    if (items.length === 0) continue;

    const rows = items.map((entry: Record<string, unknown>, index: number) => ({
      id: toId(entry._id) ?? `purchase-order-item-${id}-${index}`,
      purchaseOrderId: id,
      desc: String(entry.desc ?? ""),
      qty: toNumber(entry.qty) ?? 0,
      rate: toNumber(entry.rate) ?? 0,
      total: toNumber(entry.total) ?? 0,
    }));
    await prisma.purchaseOrderItem.createMany({ data: rows, skipDuplicates: true });
  }
}

async function migratePos(db: Db) {
  const collection = await getCollection(db, ["pos", "po"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating pos: ${docs.length}`);
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));
  const rfqIds = new Set((await prisma.rfq.findMany({ select: { id: true } })).map((row) => row.id));
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const vendorId = toId(doc.vednorId ?? doc.vendorId);
    const rfqId = toId(doc.rfqId);
    const serviceRequestId = toId(doc.serviceRequestId);
    const poNumber = String(doc.poNumber ?? `PO2-MIG-${id.slice(0, 8)}`).trim();
    if (!poNumber) continue;

    await prisma.po.upsert({
      where: { id },
      update: {
        vendorId: vendorId && supplierIds.has(vendorId) ? vendorId : null,
        poNumber,
        rfqId: rfqId && rfqIds.has(rfqId) ? rfqId : null,
        serviceRequestId:
          serviceRequestId && serviceRequestIds.has(serviceRequestId) ? serviceRequestId : null,
        billToAddress: doc.billToAddress ? String(doc.billToAddress) : null,
        billToGST: doc.billToGST ? String(doc.billToGST) : null,
        shipToAddress: doc.shipToAddress ? String(doc.shipToAddress) : null,
        shipToGST: doc.shipToGST ? String(doc.shipToGST) : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        vendorId: vendorId && supplierIds.has(vendorId) ? vendorId : null,
        poNumber,
        rfqId: rfqId && rfqIds.has(rfqId) ? rfqId : null,
        serviceRequestId:
          serviceRequestId && serviceRequestIds.has(serviceRequestId) ? serviceRequestId : null,
        billToAddress: doc.billToAddress ? String(doc.billToAddress) : null,
        billToGST: doc.billToGST ? String(doc.billToGST) : null,
        shipToAddress: doc.shipToAddress ? String(doc.shipToAddress) : null,
        shipToGST: doc.shipToGST ? String(doc.shipToGST) : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateRfqs(db: Db) {
  const collection = await getCollection(db, ["rfqs", "rfq"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating rfqs: ${docs.length}`);
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const servicePartnerIds = new Set(
    (await prisma.servicePartner.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );
  const poIds = new Set((await prisma.po.findMany({ select: { id: true } })).map((row) => row.id));
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const createdByServicePartnerUserId = toId(doc.createdByservicePartnerUserId);
    const servicePartnerId = toId(doc.servicePartnerId);
    const serviceRequestId = toId(doc.serviceRequestId);
    if (!id || !createdByServicePartnerUserId || !servicePartnerId || !serviceRequestId) continue;
    if (
      !userIds.has(createdByServicePartnerUserId) ||
      !servicePartnerIds.has(servicePartnerId) ||
      !serviceRequestIds.has(serviceRequestId)
    ) {
      continue;
    }

    const poId = toId(doc.poId);
    const rfqNo = String(doc.rfqNo ?? `RFQ-MIG-${id.slice(0, 8)}`).trim();
    if (!rfqNo) continue;

    await prisma.rfq.upsert({
      where: { id },
      update: {
        title: String(doc.title ?? `RFQ ${id.slice(0, 6)}`),
        category: String(doc.category ?? "General"),
        description: doc.description ? String(doc.description) : null,
        type: doc.type ? String(doc.type) : null,
        expectedDeadline: String(doc.expectedDeadline ?? ""),
        items: doc.items ?? null,
        status: mapRfqStatus(doc.status),
        paymentTerms: doc.paymentTerms ? String(doc.paymentTerms) : null,
        freightExtraIsApplicable:
          typeof doc.freightExtra?.isApplicable === "boolean"
            ? doc.freightExtra.isApplicable
            : typeof doc.freightExtra_isApplicable === "boolean"
              ? doc.freightExtra_isApplicable
              : null,
        freightExtraAmount: toNumber(doc.freightExtra?.amount ?? doc.freightExtra_amount) ?? null,
        createdByServicePartnerUserId,
        servicePartnerId,
        serviceRequestId,
        rfqNo,
        poId: poId && poIds.has(poId) ? poId : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        title: String(doc.title ?? `RFQ ${id.slice(0, 6)}`),
        category: String(doc.category ?? "General"),
        description: doc.description ? String(doc.description) : null,
        type: doc.type ? String(doc.type) : null,
        expectedDeadline: String(doc.expectedDeadline ?? ""),
        items: doc.items ?? null,
        status: mapRfqStatus(doc.status),
        paymentTerms: doc.paymentTerms ? String(doc.paymentTerms) : null,
        freightExtraIsApplicable:
          typeof doc.freightExtra?.isApplicable === "boolean"
            ? doc.freightExtra.isApplicable
            : typeof doc.freightExtra_isApplicable === "boolean"
              ? doc.freightExtra_isApplicable
              : null,
        freightExtraAmount: toNumber(doc.freightExtra?.amount ?? doc.freightExtra_amount) ?? null,
        createdByServicePartnerUserId,
        servicePartnerId,
        serviceRequestId,
        rfqNo,
        poId: poId && poIds.has(poId) ? poId : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });

    await prisma.rfqAssignedVendor.deleteMany({ where: { rfqId: id } });
    if (!Array.isArray(doc.assignedVendors) || doc.assignedVendors.length === 0) continue;

    const assignedRows: {
      id: string;
      rfqId: string;
      vendorId: string;
      assignedDate: Date;
      status: RfqVendorStatus;
      quotationAmount: number | null;
      quotationDetails: string | null;
      submittedAt: Date | null;
      vendorExpectedDeadline: Date | null;
    }[] = [];
    const itemRows: {
      id: string;
      rfqAssignedVendorId: string;
      itemId: string | null;
      itemName: string | null;
      unit: string | null;
      quantity: string | null;
      description: string | null;
      price: string | null;
      hsnCode: string | null;
      gstPercentage: number | null;
    }[] = [];
    const dedupe = new Set<string>();

    for (let index = 0; index < doc.assignedVendors.length; index += 1) {
      const entry = doc.assignedVendors[index] as Record<string, unknown>;
      const vendorId = toId(entry.vendorId);
      if (!vendorId || !supplierIds.has(vendorId)) continue;
      const dedupeKey = `${id}-${vendorId}`;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);

      const assignedId = toId(entry._id) ?? `rfq-vendor-${id}-${vendorId}`;
      const quotation = (entry.quotation ?? {}) as Record<string, unknown>;
      assignedRows.push({
        id: assignedId,
        rfqId: id,
        vendorId,
        assignedDate: toDate(entry.assignedDate) ?? new Date(),
        status: mapRfqVendorStatus(entry.status),
        quotationAmount: toNumber(quotation.amount) ?? null,
        quotationDetails: quotation.details ? String(quotation.details) : null,
        submittedAt: toDate(quotation.submittedAt) ?? null,
        vendorExpectedDeadline: toDate(quotation.vendorExpectedDeadline) ?? null,
      });

      if (!Array.isArray(quotation.items) || quotation.items.length === 0) continue;
      for (let itemIndex = 0; itemIndex < quotation.items.length; itemIndex += 1) {
        const item = quotation.items[itemIndex] as Record<string, unknown>;
        const itemId = toId(item.itemId);
        itemRows.push({
          id: toId(item._id) ?? `rfq-vendor-item-${assignedId}-${itemIndex}`,
          rfqAssignedVendorId: assignedId,
          itemId: itemId && itemIds.has(itemId) ? itemId : null,
          itemName: item.itemName ? String(item.itemName) : null,
          unit: item.unit ? String(item.unit) : null,
          quantity: item.quantity ? String(item.quantity) : null,
          description: item.description ? String(item.description) : null,
          price: item.price ? String(item.price) : null,
          hsnCode: item.hsnCode ? String(item.hsnCode) : null,
          gstPercentage: toNumber(item.gstPercentage) ?? null,
        });
      }
    }

    if (assignedRows.length > 0) {
      await prisma.rfqAssignedVendor.createMany({
        data: assignedRows,
        skipDuplicates: true,
      });
    }
    if (itemRows.length > 0) {
      await prisma.rfqAssignedVendorItem.createMany({
        data: itemRows,
        skipDuplicates: true,
      });
    }
  }
}

async function migratePosRfqLinks(db: Db) {
  const collection = await getCollection(db, ["pos", "po"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  const rfqIds = new Set((await prisma.rfq.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    const rfqId = toId(doc.rfqId);
    if (!id || !rfqId || !rfqIds.has(rfqId)) continue;
    await prisma.po.update({
      where: { id },
      data: { rfqId },
    });
  }
}

async function migrateVendors(db: Db) {
  const collection = await getCollection(db, ["vendors"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating vendors: ${docs.length}`);

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    await prisma.vendor.upsert({
      where: { id },
      update: {
        email: String(doc.email ?? `${id}@vendor.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        isVendor: typeof doc.isVendor === "boolean" ? doc.isVendor : true,
        isVerified: typeof doc.isVerified === "boolean" ? doc.isVerified : false,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        country: doc.country ? String(doc.country) : null,
        companyName: doc.companyName ? String(doc.companyName) : null,
        address: doc.address ? String(doc.address) : null,
        type: doc.type ? String(doc.type) : null,
        legalStatus: mapLegalStatus(doc.legalStatus),
        contactPerson: doc.contactPerson ? String(doc.contactPerson) : null,
        dealingIn: mapDealingIn(doc.dealingIn),
        documentsType: mapVendorDocumentType(doc.documentsType),
        documentLinks: toStringList(doc.documentLink),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        email: String(doc.email ?? `${id}@vendor.local`),
        mobile: String(doc.mobile ?? id.slice(0, 10)),
        isVendor: typeof doc.isVendor === "boolean" ? doc.isVendor : true,
        isVerified: typeof doc.isVerified === "boolean" ? doc.isVerified : false,
        profileImage: doc.profileImage ? String(doc.profileImage) : null,
        country: doc.country ? String(doc.country) : null,
        companyName: doc.companyName ? String(doc.companyName) : null,
        address: doc.address ? String(doc.address) : null,
        type: doc.type ? String(doc.type) : null,
        legalStatus: mapLegalStatus(doc.legalStatus),
        contactPerson: doc.contactPerson ? String(doc.contactPerson) : null,
        dealingIn: mapDealingIn(doc.dealingIn),
        documentsType: mapVendorDocumentType(doc.documentsType),
        documentLinks: toStringList(doc.documentLink),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
    });
  }
}

async function migrateInvoices(db: Db) {
  const collection = await getCollection(db, ["invoices", "invoice"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating invoices: ${docs.length}`);
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));
  const poIds = new Set((await prisma.po.findMany({ select: { id: true } })).map((row) => row.id));
  const rfqIds = new Set((await prisma.rfq.findMany({ select: { id: true } })).map((row) => row.id));
  const itemIds = new Set((await prisma.item.findMany({ select: { id: true } })).map((row) => row.id));

  for (const doc of docs) {
    const id = toId(doc._id);
    if (!id) continue;
    const vendorId = toId(doc.vendorId);
    const poId = toId(doc.poId);
    const rfqId = toId(doc.rfqId);

    await runWithRetry(`invoice upsert ${id}`, () =>
      prisma.invoice.upsert({
      where: { id },
      update: {
        vendorId: vendorId && supplierIds.has(vendorId) ? vendorId : null,
        poId: poId && poIds.has(poId) ? poId : null,
        rfqId: rfqId && rfqIds.has(rfqId) ? rfqId : null,
        usedQuantity: toNumber(doc.usedQuantity) ?? null,
        consumedPrice: toNumber(doc.consumedPrice) ?? null,
        actualQuantity: toNumber(doc.actualQuantity) ?? null,
        actualPrice: toNumber(doc.actulPrice) ?? null,
        totalAmount: toNumber(doc.totalAmount) ?? null,
        invoiceCount: toNumber(doc.invoiceCount) ?? 0,
        isInvoiceGenerated: Boolean(doc.isInvoiceGenerated ?? false),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        vendorId: vendorId && supplierIds.has(vendorId) ? vendorId : null,
        poId: poId && poIds.has(poId) ? poId : null,
        rfqId: rfqId && rfqIds.has(rfqId) ? rfqId : null,
        usedQuantity: toNumber(doc.usedQuantity) ?? null,
        consumedPrice: toNumber(doc.consumedPrice) ?? null,
        actualQuantity: toNumber(doc.actualQuantity) ?? null,
        actualPrice: toNumber(doc.actulPrice) ?? null,
        totalAmount: toNumber(doc.totalAmount) ?? null,
        invoiceCount: toNumber(doc.invoiceCount) ?? 0,
        isInvoiceGenerated: Boolean(doc.isInvoiceGenerated ?? false),
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      })
    );

    await runWithRetry(`invoiceEntry deleteMany ${id}`, () =>
      prisma.invoiceEntry.deleteMany({ where: { invoiceId: id } })
    );
    if (!Array.isArray(doc.invoiceData) || doc.invoiceData.length === 0) continue;

    const entryRows = doc.invoiceData.map((entry: Record<string, unknown>, index: number) => ({
      id: toId(entry._id) ?? `invoice-entry-${id}-${index}`,
      invoiceId: id,
      date: toDate(entry.date) ?? null,
      isApproved: mapApprovalStatus(entry.isApproved),
      approvalDate: toDate(entry.approvalDate) ?? null,
      isPaid: mapInvoicePaidStatus(entry.isPaid),
      attachment: entry.attachment ? String(entry.attachment) : null,
    }));
    for (const [chunkIndex, chunk] of chunkArray(entryRows, 50).entries()) {
      await runWithRetry(`invoiceEntry createMany ${id} chunk ${chunkIndex + 1}`, () =>
        prisma.invoiceEntry.createMany({ data: chunk, skipDuplicates: true })
      );
    }

    const itemRows: {
      id: string;
      invoiceEntryId: string;
      itemId: string | null;
      hsnCode: string | null;
      quantity: number | null;
      price: number | null;
      usedQuantity: number | null;
      consumedPrice: number | null;
    }[] = [];

    for (let entryIndex = 0; entryIndex < doc.invoiceData.length; entryIndex += 1) {
      const entry = doc.invoiceData[entryIndex] as Record<string, unknown>;
      if (!Array.isArray(entry.items) || entry.items.length === 0) continue;
      const entryId = toId(entry._id) ?? `invoice-entry-${id}-${entryIndex}`;

      for (let itemIndex = 0; itemIndex < entry.items.length; itemIndex += 1) {
        const item = entry.items[itemIndex] as Record<string, unknown>;
        const itemId = toId(item.itemId);
        itemRows.push({
          id: toId(item._id) ?? `invoice-item-${entryId}-${itemIndex}`,
          invoiceEntryId: entryId,
          itemId: itemId && itemIds.has(itemId) ? itemId : null,
          hsnCode: item.hsnCode ? String(item.hsnCode) : null,
          quantity: toNumber(item.quantity) ?? null,
          price: toNumber(item.price) ?? null,
          usedQuantity: toNumber(item.usedQuantity) ?? null,
          consumedPrice: toNumber(item.consumedPrice) ?? null,
        });
      }
    }

    if (itemRows.length > 0) {
      for (const [chunkIndex, chunk] of chunkArray(itemRows, 200).entries()) {
        await runWithRetry(`invoiceEntryItem createMany ${id} chunk ${chunkIndex + 1}`, () =>
          prisma.invoiceEntryItem.createMany({ data: chunk, skipDuplicates: true })
        );
      }
    }
  }
}

async function migrateVendorPayments(db: Db) {
  const collection = await getCollection(db, ["vendorpayments", "vendorPayments"]);
  if (!collection) return;
  const docs = await collection.find({}).toArray();
  console.log(`Migrating vendor payments: ${docs.length}`);
  const supplierIds = new Set((await prisma.supplier.findMany({ select: { id: true } })).map((row) => row.id));
  const inventoryIds = new Set((await prisma.inventory.findMany({ select: { id: true } })).map((row) => row.id));
  const poIds = new Set((await prisma.po.findMany({ select: { id: true } })).map((row) => row.id));
  const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const serviceRequestIds = new Set(
    (await prisma.serviceRequest.findMany({ select: { id: true } })).map((row) => row.id)
  );

  for (const doc of docs) {
    const id = toId(doc._id);
    const vendorId = toId(doc.vendor ?? doc.vendorId);
    const requestedById = toId(doc.requestedBy);
    if (!id || !vendorId || !requestedById) continue;
    if (!supplierIds.has(vendorId) || !userIds.has(requestedById)) continue;

    const billId = toId(doc.billId);
    const poId = toId(doc.po ?? doc.poId);
    const approvedById = toId(doc.approved_by);
    const markAsPaidById = toId(doc.mark_as_paid_by);
    const serviceRequestId = toId(doc.serviceRequestId);

    await runWithRetry(`vendorPayment upsert ${id}`, () =>
      prisma.vendorPayment.upsert({
      where: { id },
      update: {
        vendorId,
        billId: billId && inventoryIds.has(billId) ? billId : null,
        poId: poId && poIds.has(poId) ? poId : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        attachment: doc.attachment ? String(doc.attachment) : null,
        remarks: doc.remarks ? String(doc.remarks) : null,
        status: mapPaymentStatus(doc.status),
        requestedById,
        requestedAt: toDate(doc.requestedAt) ?? new Date(),
        approvedById: approvedById && userIds.has(approvedById) ? approvedById : null,
        approvedDate: toDate(doc.approved_date) ?? null,
        markAsPaidById: markAsPaidById && userIds.has(markAsPaidById) ? markAsPaidById : null,
        markAsPaidDate: toDate(doc.mark_as_paid_date) ?? null,
        serviceRequestId:
          serviceRequestId && serviceRequestIds.has(serviceRequestId) ? serviceRequestId : null,
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      create: {
        id,
        vendorId,
        billId: billId && inventoryIds.has(billId) ? billId : null,
        poId: poId && poIds.has(poId) ? poId : null,
        amount: toNumber(doc.amount) ?? 0,
        approvedAmount: toNumber(doc.approved_amount) ?? null,
        attachment: doc.attachment ? String(doc.attachment) : null,
        remarks: doc.remarks ? String(doc.remarks) : null,
        status: mapPaymentStatus(doc.status),
        requestedById,
        requestedAt: toDate(doc.requestedAt) ?? new Date(),
        approvedById: approvedById && userIds.has(approvedById) ? approvedById : null,
        approvedDate: toDate(doc.approved_date) ?? null,
        markAsPaidById: markAsPaidById && userIds.has(markAsPaidById) ? markAsPaidById : null,
        markAsPaidDate: toDate(doc.mark_as_paid_date) ?? null,
        serviceRequestId:
          serviceRequestId && serviceRequestIds.has(serviceRequestId) ? serviceRequestId : null,
        createdAt: toDate(doc.createdAt) ?? new Date(),
        updatedAt: toDate(doc.updatedAt) ?? new Date(),
      },
      })
    );
  }
}

async function run() {
  const mongoClient = new MongoClient(resolvedMongoUrl);
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);

  console.log(`Connected Mongo source DB: ${mongoDbName}`);
  console.log("Starting migration of core + operational collections");
  const steps: Array<{ key: string; run: () => Promise<void> }> = [
    { key: "service_partners", run: () => migrateServicePartners(db) },
    { key: "roles", run: () => migrateRoles(db) },
    { key: "users", run: () => migrateUsers(db) },
    { key: "clients", run: () => migrateClients(db) },
    { key: "client_users", run: () => migrateClientUsers(db) },
    { key: "branches", run: () => migrateBranches(db) },
    { key: "categories", run: () => migrateCategories(db) },
    { key: "client_service_partners", run: () => migrateClientServicePartners(db) },
    { key: "service_requests", run: () => migrateServiceRequests(db) },
    { key: "suppliers", run: () => migrateSuppliers(db) },
    { key: "items", run: () => migrateItems(db) },
    { key: "rcs", run: () => migrateRcs(db) },
    { key: "otps", run: () => migrateOtps(db) },
    { key: "tasks", run: () => migrateTasks(db) },
    { key: "time_logs", run: () => migrateTimeLogs(db) },
    { key: "payments", run: () => migratePayments(db) },
    { key: "quotations", run: () => migrateQuotations(db) },
    { key: "expenses", run: () => migrateExpenses(db) },
    { key: "inventory_requests", run: () => migrateInventoryRequests(db) },
    { key: "sites", run: () => migrateSites(db) },
    { key: "inventories", run: () => migrateInventories(db) },
    { key: "assign_services", run: () => migrateAssignServices(db) },
    { key: "purchase_orders", run: () => migratePurchaseOrders(db) },
    { key: "pos", run: () => migratePos(db) },
    { key: "rfqs", run: () => migrateRfqs(db) },
    { key: "pos_rfq_links", run: () => migratePosRfqLinks(db) },
    { key: "vendors", run: () => migrateVendors(db) },
    { key: "invoices", run: () => migrateInvoices(db) },
    { key: "vendor_payments", run: () => migrateVendorPayments(db) },
  ];
  const startFromRaw = String(process.env.MIGRATION_START_FROM ?? "").trim().toLowerCase();
  let startIndex = 0;
  if (startFromRaw) {
    const index = steps.findIndex((step) => step.key === startFromRaw);
    if (index >= 0) {
      startIndex = index;
      console.log(`Resuming migration from step: ${steps[startIndex].key}`);
    } else {
      console.warn(
        `Unknown MIGRATION_START_FROM="${startFromRaw}". Running full migration from beginning.`
      );
    }
  }
  for (let index = startIndex; index < steps.length; index += 1) {
    const step = steps[index];
    let attempt = 1;
    const maxAttempts = 5;

    while (true) {
      try {
        if (attempt > 1) {
          console.log(`[retry ${attempt}/${maxAttempts}] Re-running step: ${step.key}`);
        }
        await step.run();
        break;
      } catch (error) {
        if (!isRetryablePrismaError(error) || attempt >= maxAttempts) {
          throw error;
        }

        const waitMs = attempt * 2000;
        console.warn(
          `[retry ${attempt}/${maxAttempts}] Step "${step.key}" failed due to transient DB error. Retrying in ${waitMs}ms...`
        );
        try {
          await prisma.$disconnect();
        } catch {
          // ignore disconnect error on retry path
        }
        prisma = new PrismaClient();
        await sleep(waitMs);
        attempt += 1;
      }
    }
  }

  console.log("Migration completed.");
  await mongoClient.close();
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
