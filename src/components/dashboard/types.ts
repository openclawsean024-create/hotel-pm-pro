// components/dashboard/types.ts — shared TS contracts

export type RoomState =
  | "empty"
  | "occupied"
  | "checkout_today"
  | "cleaning"
  | "maintenance";

export type Room = {
  id: string;
  name: string;
  roomType: string;
  state: RoomState;
  propertyId: string;
};

export type TimelineItem = {
  time: string;
  type: "checkin" | "checkout" | "cleaning" | "maintenance";
  propertyId: string;
  meta: string;
  pill: { label: string; tone: "ready" | "pending" | "blocked" | "info" };
};

export type WorkbenchItem = {
  id: string;
  kind: "requirement" | "maintenance";
  kindLabel: string;
  title: string;
  propertyId: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: string | null;
  status: string;
};

export type PropertyPerformance = {
  id: string;
  name: string;
  mtdRevenue: number;
  occupancy: number;
};

export type DashboardSummary = {
  properties: PropertyOption[];
  kpi: {
    checkInsToday: number;
    checkOutsToday: number;
    revenueMonth: number;
    openCases: number;
  };
  occupancy: {
    rate: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
  };
  rooms: Room[];
  timeline: TimelineItem[];
  workbench: WorkbenchItem[];
  revenueSeries: { month: string; total: number }[];
  propertyPerformance: PropertyPerformance[];
};

export type PropertyOption = {
  id: string;
  name: string;
  roomType: string;
};
