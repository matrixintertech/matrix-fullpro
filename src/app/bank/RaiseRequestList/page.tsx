"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import type { ServiceRequestListResponse } from "@/types/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RaiseRequestList from "@/components/service/RaiseRequestListTable";
import type { ServiceListItem } from "@/types/domain";
import styles from "./page.module.css";

export default function ListServices() {
  const router = useRouter();
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiRequest<ServiceRequestListResponse>("/api/service-requests", {
          method: "GET",
          withAuth: true,
        });
        if (!isMounted) return;
        const mapped: ServiceListItem[] = data.map((item) => ({
          id: item.serviceNumber,
          date: new Date(item.createdAt).toISOString().slice(0, 10),
          title: item.title,
          description: item.description ?? "-",
          status: "Request Sent",
        }));
        setServices(mapped);
      } catch (requestError) {
        if (!isMounted) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load requests");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchServices();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusClass = (status: ServiceListItem["status"]): string => {
    switch (status.toLowerCase()) {
      case "request sent":
        return styles.requestSent;
      case "work in progress":
        return styles.workInProgress;
      case "rejected":
        return styles.rejected;
      case "revised":
        return styles.revised;
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <RaiseRequestList
        services={services}
        getStatusClass={getStatusClass}
        isLoading={isLoading}
        error={error}
        onRaiseNew={() => router.push("/bank/RaiseService")}
      />
    </DashboardLayout>
  );
}

