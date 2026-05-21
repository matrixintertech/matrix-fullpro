"use client";

import Image from "next/image";
import { X } from "lucide-react";
import type { TaskRow } from "@/types/domain";
import styles from "../TaskDetailModal/page.module.css";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskData: TaskRow | null;
}

export default function TaskDetailModal({ isOpen, onClose }: TaskDetailModalProps) {
  if (!isOpen) return null;

  const sampleImages = [
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
    "/api/placeholder/250/200",
  ];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <button onClick={onClose} className={styles.closeButton}>
          <X className="h-6 w-6" />
        </button>
        <h2 className={styles.modalTitle}>After Service Image</h2>
        <div className={styles.imageGrid}>
          {sampleImages.map((img, index) => (
            <div key={index} className={styles.imageContainer}>
              <Image
                src={img}
                alt={`Service image ${index + 1}`}
                className={styles.image}
                width={250}
                height={200}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
