"use client";

import { Eye, ListFilter, PlusCircle, Search } from "lucide-react";
import { useState } from "react";
import type { ServiceListItem } from "@/types/domain";
import styles from "./RaiseRequestListTable.module.css";

interface RaiseRequestListProps {
  services: ServiceListItem[];
  getStatusClass: (status: ServiceListItem["status"]) => string;
  isLoading?: boolean;
  error?: string | null;
  onRaiseNew?: () => void;
}

export default function RaiseRequestList({
  services,
  getStatusClass,
  isLoading = false,
  error = null,
  onRaiseNew,
}: RaiseRequestListProps) {
  const [selectedSort, setSelectedSort] = useState("New to oldest");

  const handleSortChange = (value: string) => {
    setSelectedSort(value);
  };

  return (
    <div className={styles["page-container"]}>
      <div className={styles["main-heading"]}><h1>List Services</h1></div>
      <div className={styles.controlBar}>
        <div className={styles["sub-heading"]}><h2>All Services</h2></div>

        <div className={styles.filterContainer}>
          <div className={styles.searchBox}>
            <Search className={styles.searchIcon} size={20} />
            <input type="text" placeholder="Search here" />
          </div>

          <select className={styles.statusFilter}>
            <option>Status</option>
          </select>
        </div>

        <div className={styles.sortButtonContainer}>
          {/* Custom Dropdown for Sorting */}
          <div className={styles.customDropdown}>
            <div className={styles.dropdownHeader}>
              <ListFilter size={20} />
              <span>{selectedSort}</span>
            </div>
            <div className={styles.dropdownMenu}>
              <div
                onClick={() => handleSortChange("New to oldest")}
                className={styles.dropdownItem}
              >
                <ListFilter size={20} />
                <span>New to oldest</span>
              </div>
            </div>
          </div>

          <button className={styles.raiseButton} onClick={onRaiseNew}>
            Raise New Service <PlusCircle size={16} />
          </button>
        </div>
      </div>
      {error ? <p style={{ color: "#b91c1c", margin: "8px 0" }}>{error}</p> : null}
      {isLoading ? <p style={{ margin: "8px 0" }}>Loading services...</p> : null}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Title</th>
              <th>Description</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service: ServiceListItem) => (
              <tr key={service.id}>
                <td>{service.id}</td>
                <td>{service.date}</td>
                <td>{service.title}</td>
                <td>{service.description}</td>
                <td>
                  <span className={`${styles.status} ${getStatusClass(service.status)}`}>
                    {service.status}
                  </span>
                </td>
                <td className={styles.actionColumn}>
                  <button className={styles.actionButton}>
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

