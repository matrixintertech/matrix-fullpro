const router = require("express").Router();

const otpRoutes = require("../src/modules/otp/otp-routes");
const UserRoutes = require("../src/modules/user/user-route");
const RoleRoutes = require("../src/modules/role/role-routes");
const RcRoutes = require("../src/modules/rc/rc-routes");
const CategoryRoutes = require("../src/modules/category/category-routes");
const SupplierRoutes = require("../src/modules/supplier/supplier-routes");
const ClientUserRoutes = require("../src/modules/client-user/clientUser-routes");
const ClientServicePartnerRoutes = require("../src/modules/client-service-partner/client-service-partner-routes");
const ItemRoutes = require("../src/modules/item/item-route");
const InventoryRoutes = require("../src/modules/inventory/inventory-route");
const ServiceRequest = require("../src/modules/serviceRequests/service-request-routes");
const ClientRoutes = require("../src/modules/client/client-routes");
const BranchRoutes = require("../src/modules/branch/branch-routes");
const ServicePartnerRoutes = require("../src/modules/service-partner/service-partner-routes");
const AssignServiceRoutes = require("../src/modules/assign-serivce/assign-service-route");
const QuotationsRoutes = require("../src/modules/quotation/quotation-route");
const DiscussionBoardRoutes = require("../src/modules/discussion-board/discussion-board-routes");
const UtilityRoutes = require("../src/modules/utility/utility-route");
const PaymentsRoutes = require("../src/modules/payments/payment-route");
const ExpensesRoutes = require("../src/modules/expenses/expense-route");
const TimeLogRoutes = require("../src/modules/timeLog/time-log-routes");
const PermissionsRoutes = require("../src/modules/permissions/permissions-route");
const TaskRoutes = require("../src/modules/task/task-route");
const InventoryRequestRoutes = require("../src/modules/inventory-request/inventory-request-routes");
const PurchaseOrder = require("../src/modules/purchase-order/purchase-order-routes");
const VendorRoutes = require("../src/modules/vendor/vendor-route");
const RFQRoutes = require("../src/modules/rfq/rfqRoute");
const PoRoutes = require("../src/modules/purchasing-order/poRoute");
const vendorPaymentRoute = require("../src/modules/vendor-payment/vendor-payment-route");
const ActivityLogRoutes = require("../src/modules/activity-log/activity-log-routes");

const InvoiceRoutes = require("../src/modules/invoice/invoice-route");

const moduleRoutes = [
  {
    path: "/otp",
    route: otpRoutes,
  },
  {
    path: "/payments",
    route: PaymentsRoutes,
  },
  {
    path: "/expenses",
    route: ExpensesRoutes,
  },
  {
    path: "/permissions",
    route: PermissionsRoutes,
  },
  {
    path: "/time-log",
    route: TimeLogRoutes,
  },
  {
    path: "/quotations",
    route: QuotationsRoutes,
  },
  {
    path: "/assign-service",
    route: AssignServiceRoutes,
  },
  {
    path: "/item",
    route: ItemRoutes,
  },
  {
    path: "/inventory",
    route: InventoryRoutes,
  },
  {
    path: "/user",
    route: UserRoutes,
  },
  {
    path: "/Clientuser",
    route: ClientUserRoutes,
  },
  {
    path: "/client-service-partner",
    route: ClientServicePartnerRoutes,
  },
  {
    path: "/role",
    route: RoleRoutes,
  },
  {
    path: "/rc",
    route: RcRoutes,
  },
  {
    path: "/category",
    route: CategoryRoutes,
  },
  {
    path: "/branch",
    route: BranchRoutes,
  },
  {
    path: "/supplier",
    route: SupplierRoutes,
  },
  {
    path: "/serviceRequest",
    route: ServiceRequest,
  },
  {
    path: "/Client",
    route: ClientRoutes,
  },
  {
    path: "/service-partner",
    route: ServicePartnerRoutes,
  },
  {
    path: "/discussion-board",
    route: DiscussionBoardRoutes,
  },
  {
    path: "/utility",
    route: UtilityRoutes,
  },
  {
    path: "/task",
    route: TaskRoutes,
  },
  {
    path: "/inventory-request",
    route: InventoryRequestRoutes,
  },
  {
    path: "/purchase-order",
    route: PurchaseOrder,
  },
  {
    path: "/vendor",
    route: VendorRoutes,
  },
  {
    path: "/rfq",
    route: RFQRoutes,
  },
  {
    path: "/po",
    route: PoRoutes,
  },
  {
    path: "/vendor-payment",
    route: vendorPaymentRoute,
  },
  {
    path: "/invoice",
    route: InvoiceRoutes,
  },
  {
    path: "/activity-log",
    route: ActivityLogRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
