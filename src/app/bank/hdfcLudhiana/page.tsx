import type { ReactNode } from "react";
import Image from "next/image";
import DashboardLayout from "@/components/layout/DashboardLayout";
import styles from "./page.module.css";

interface HierarchyNodeProps {
  title: string;
  imageSrc?: string;
  color: string;
  children?: ReactNode;
}

const HierarchyNode = ({ title, imageSrc, color, children }: HierarchyNodeProps) => (
  <div className={styles.node}>
    <div className={styles.nodeWrapper} style={{ backgroundColor: color }}>
      <div className={styles.avatarContainer}>
        <Image
          src={imageSrc ?? "/api/placeholder/60/60"}
          alt={`${title} avatar`}
          width={60}
          height={60}
          className={styles.avatar}
        />
      </div>
      <div className={styles.nodeTitle}>{title}</div>
    </div>
    {children && (
      <>
        <div className={styles.verticalLine}></div>
        <div className={styles.childrenContainer}>{children}</div>
      </>
    )}
  </div>
);

export default function HierarchyPage() {
  return (
    <DashboardLayout>
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardContent}>
          <h1 className={styles.title}>HDFC-Ludhiana Hierarchy</h1>

          <div className={styles.hierarchyContainer}>
            <HierarchyNode title="Country Head" color="#B033EE">
              {/* First Level: Regional Heads */}
              <HierarchyNode title="Regional Head" color="#CCCCFF" />
              
              <HierarchyNode title="Regional Head" color="#CCCCFF">
                {/* Second Level: State Heads */}
                <HierarchyNode title="State Head" color="#A3A3F1" />
                
                <HierarchyNode title="State Head" color="#A3A3F1">
                  {/* Third Level: Cluster Heads */}
                  <HierarchyNode title="Cluster Head" color="#D3D3FF" />
                  
                  <HierarchyNode title="Cluster Head" color="#D3D3FF">
                    {/* Fourth Level: Users */}
                    <HierarchyNode title="User Akshay" color="#E6E6FF" />
                    <HierarchyNode title="User Ashi" color="#E6E6FF" />
                    <HierarchyNode title="User Harsh" color="#E6E6FF" />
                  </HierarchyNode>
                  
                  <HierarchyNode title="Cluster Head" color="#D3D3FF" />
                </HierarchyNode>
                
                <HierarchyNode title="State Head" color="#A3A3F1" />
              </HierarchyNode>

              <HierarchyNode title="Regional Head" color="#CCCCFF" />
            </HierarchyNode>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

