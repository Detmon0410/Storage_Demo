import {
  ArrowLeftRight,
  Boxes,
  FileCheck2,
  Factory,
  LayoutDashboard,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.group.overview",
    items: [{ to: "/", labelKey: "nav.item.dashboard", icon: LayoutDashboard }],
  },
  {
    titleKey: "nav.group.import",
    items: [
      { to: "/import-orders", labelKey: "nav.item.importOrders", icon: Truck },
      { to: "/suppliers", labelKey: "nav.item.suppliers", icon: Factory },
    ],
  },
  {
    titleKey: "nav.group.product",
    items: [
      { to: "/products", labelKey: "nav.item.products", icon: Wine },
      { to: "/categories", labelKey: "nav.item.categories", icon: Tags },
      { to: "/inventory-stocks", labelKey: "nav.item.inventoryStocks", icon: Boxes },
      { to: "/stock-transactions", labelKey: "nav.item.stockTransactions", icon: ArrowLeftRight },
    ],
  },
  {
    titleKey: "nav.group.compliance",
    items: [{ to: "/licenses", labelKey: "nav.item.licenses", icon: FileCheck2 }],
  },
  {
    titleKey: "nav.group.sales",
    items: [
      { to: "/customers", labelKey: "nav.item.customers", icon: Users },
      { to: "/sales-orders", labelKey: "nav.item.salesOrders", icon: ShoppingCart },
    ],
  },
];
