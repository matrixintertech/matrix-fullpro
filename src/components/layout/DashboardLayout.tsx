import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import styles from "./Dashboard.module.css";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className={styles.container}>
      <Sidebar />
      <div className={styles.mainContent}>
        <div className={styles.mainSection}>{children}</div>
      </div>
    </div>
  );
}

