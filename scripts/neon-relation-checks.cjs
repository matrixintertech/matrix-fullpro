const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const checks = [
  {
    name: "service_requests.clientId -> clients.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM service_requests s
          LEFT JOIN clients c ON c.id = s."clientId"
          WHERE s."clientId" IS NOT NULL AND c.id IS NULL`,
  },
  {
    name: "service_requests.clientUserId -> client_users.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM service_requests s
          LEFT JOIN client_users cu ON cu.id = s."clientUserId"
          WHERE s."clientUserId" IS NOT NULL AND cu.id IS NULL`,
  },
  {
    name: "service_requests.servicePartnerId -> service_partners.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM service_requests s
          LEFT JOIN service_partners sp ON sp.id = s."servicePartnerId"
          WHERE s."servicePartnerId" IS NOT NULL AND sp.id IS NULL`,
  },
  {
    name: "tasks.serviceRequestId -> service_requests.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM tasks t
          LEFT JOIN service_requests s ON s.id = t."serviceRequestId"
          WHERE t."serviceRequestId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "tasks.user_id -> users.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM tasks t
          LEFT JOIN users u ON u.id = t.user_id
          WHERE t.user_id IS NOT NULL AND u.id IS NULL`,
  },
  {
    name: "time_logs.serviceRequestId -> service_requests.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM time_logs tl
          LEFT JOIN service_requests s ON s.id = tl."serviceRequestId"
          WHERE tl."serviceRequestId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "time_logs.task_id -> tasks.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM time_logs tl
          LEFT JOIN tasks t ON t.id = tl.task_id
          WHERE tl.task_id IS NOT NULL AND t.id IS NULL`,
  },
  {
    name: "payments.serviceRequestId -> service_requests.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM payments p
          LEFT JOIN service_requests s ON s.id = p."serviceRequestId"
          WHERE p."serviceRequestId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "expenses.vendorId -> suppliers.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM expenses e
          LEFT JOIN suppliers s ON s.id = e."vendorId"
          WHERE e."vendorId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "vendor_payments.vendorId -> suppliers.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM vendor_payments vp
          LEFT JOIN suppliers s ON s.id = vp."vendorId"
          WHERE vp."vendorId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "quotations.serviceRequestId -> service_requests.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM quotations q
          LEFT JOIN service_requests s ON s.id = q."serviceRequestId"
          WHERE q."serviceRequestId" IS NOT NULL AND s.id IS NULL`,
  },
  {
    name: "quotation_rc_items.rc_id -> rcs.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM quotation_rc_items qri
          LEFT JOIN rcs r ON r.id = qri.rc_id
          WHERE qri.rc_id IS NOT NULL AND r.id IS NULL`,
  },
  {
    name: "inventory_request_items.item -> items.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM inventory_request_items iri
          LEFT JOIN items i ON i.id = iri.item
          WHERE iri.item IS NOT NULL AND i.id IS NULL`,
  },
  {
    name: "inventory_items.inventory_id -> items.id",
    sql: `SELECT COUNT(*)::int AS count
          FROM inventory_items ii
          LEFT JOIN items i ON i.id = ii.inventory_id
          WHERE ii.inventory_id IS NOT NULL AND i.id IS NULL`,
  },
];

async function main() {
  const out = [];
  for (const check of checks) {
    const result = await prisma.$queryRawUnsafe(check.sql);
    out.push({ check: check.name, orphans: result[0].count });
  }
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
