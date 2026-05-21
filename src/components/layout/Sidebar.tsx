"use client";

import Image from "next/image";
import { Building2, LogOut, PlusSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken } from "@/lib/client-auth";
import styles from "./Sidebar.module.css";
import listServicesIcon from "../../../public/vectors/list-services-icon.png";

export default function Sidebar() {
  const router = useRouter();
  const currentRoute = usePathname();
  const isAddServiceRequestDisabled = false;

  const handleNavigation = (path: string, isDisabled = false) => {
    if (!isDisabled) {
      router.push(path);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    router.push("/bank");
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <Image 
          src="/images/logo.png" 
          alt="Matrix Logo" 
          width={255}
          height={102}
        />
      </div>

      <div className={styles.menu}>
        <h3>MAIN</h3>
        <ul>
          <li
            className={`${styles.listServices} ${currentRoute === "/bank/RaiseRequestList" ? styles.active : ""}`}
            onClick={() => handleNavigation("/bank/RaiseRequestList")}
          >
            <span className={styles.icon}>
              <Image
                src={listServicesIcon}
                alt="List Services Icon"
                width={24}
                height={24}
                className={styles.vectorListServices}
              />
            </span>
            List Services
          </li>

          <li
            className={`${styles.addServiceRequest} ${currentRoute === "/bank/RaiseService" ? styles.active : ""}`}
            onClick={() =>
              handleNavigation("/bank/RaiseService", isAddServiceRequestDisabled)
            }
            style={{ opacity: isAddServiceRequestDisabled ? 0.5 : 1 }}
          >
            <span className={styles.icon}>
              <PlusSquare size={18} />
            </span>
            Add Service Request
          </li>

          <li
            className={`${styles.hdfcLudhiana} ${currentRoute === "/bank/hdfcLudhiana" ? styles.active : ""}`}
            onClick={() => handleNavigation("/bank/hdfcLudhiana")}
          >
            <span className={styles.icon}>
              <Building2 size={18} />
            </span>
            HDFC - Ludhiana
          </li>
        </ul>

        <h3>SETTINGS</h3>
        <ul>
          <li onClick={handleLogout}>
            <span className={styles.icon}>
              <LogOut size={18} />
            </span>
            Logout
          </li>
        </ul>
      </div>
    </div>
  );
}

