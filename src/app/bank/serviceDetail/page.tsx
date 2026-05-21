"use client";

import { Check, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import type { TimelineStep } from "@/types/domain";
import DashboardLayout from "@/components/layout/DashboardLayout";
import styles from "./page.module.css";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImageModal = ({ isOpen, onClose }: ImageModalProps) => {
  if (!isOpen) return null;

  const images = Array(8).fill(null).map((_, index) => ({
    id: index + 1,
    src: `/api/placeholder/250/200`,
    alt: `Before Image ${index + 1}`
  }));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Before Images</h2>
          <button onClick={onClose} className={styles.closeButton}>
            Close
          </button>
        </div>
        <div className={styles.imageGrid}>
          {images.map((image) => (
            <div key={image.id} className={styles.imageWrapper}>
              <Image
                src={image.src}
                alt={image.alt}
                className={styles.gridImage}
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
};

export default function ServiceDetailContent() {
  const router = useRouter();
  const [currentStep] = useState(3);
  const [isImageModalOpen, setImageModalOpen] = useState(false);
  const [isQuoteVisible, setQuoteVisible] = useState(false);

  const steps: TimelineStep[] = [
    {
      title: 'Service Request Raised',
      description: 'Service request logged by support desk',
      completed: true
    },
    {
      title: 'Task Assigned to Project Manager',
      description: 'Waiting for project manager to analyze the task.',
      completed: true
    },
    {
      title: 'Quote prepared for the task',
      description: 'Waiting for service manager to prepare the quote of the task.',
      completed: true,
      hasAction: true,
      actionLabel: 'View Quote',
      action: () => setQuoteVisible(!isQuoteVisible)
    },
    {
      title: 'Task In Progress',
      description: 'Working on Teak wood moulding',
      completed: false,
      hasAction: true,
      actionLabel: 'View Steps',
      action: () => router.push("/bank/serviceDetail/TaskDetail")
    },
    {
      title: 'Task Completed',
      description: 'Waiting for client to approve the task.',
      completed: false
    }
  ];

  return (
    <DashboardLayout>
      <div className={styles.serviceContainer}>
        <header className={styles.header}>
          <h1 className={styles.title}>Service Detailed Hierarchy</h1>
          <div className={styles.buttonGroup}>
            <button
              className={styles.beforeImageBtn}
              onClick={() => setImageModalOpen(true)}
            >
              <Clock size={16} />
              Before Image
            </button>
            <button className={styles.discussionBtn}>
              + Discussion Board
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.scrollableYContainer}>
            <div className={styles.timeline}>
              {steps.map((step, index) => (
                <div key={index} className={styles.timelineItem}>
                  {index < steps.length - 1 && (
                    <div
                      className={`${styles.connector} ${index < currentStep ? styles.connectorActive : ''}`}
                    />
                  )}

                  <div
                    className={`${styles.statusCircle} ${step.completed ? styles.statusCircleCompleted : styles.statusCirclePending}`}
                  >
                    {step.completed && <Check size={16} />}
                  </div>

                  <div className={styles.itemContent}>
                    <h3 className={styles.itemTitle}>{step.title}</h3>
                    <p className={styles.itemDescription}>{step.description}</p>
                    {step.hasAction && (
                      <>
                        <button
                          className={styles.actionButton}
                          onClick={step.action}
                        >
                          {step.actionLabel} {
                            (step.title === 'Quote prepared for the task' && isQuoteVisible) 
                              ? <ChevronUp strokeWidth={2} />
                              : <ChevronDown strokeWidth={2} />
                          }
                        </button>
                        {isQuoteVisible && step.title === 'Quote prepared for the task' && (
                          <div className={styles.quoteDetails}>
                            <h3>Service/Product Description: Renovation</h3>
                            <p>Cost breakdown:</p>
                            <ul>
                              <li>Material: Rs. 20,159</li>
                              <li>Labor: Rs. 1500/day</li>
                            </ul>
                            <p>Total: Rs. 20,159 (excluding labor charges)</p>
                            <p>Quote valid till 3 days</p>
                            <div className={styles.actionButtons}>
                              <button className={styles.approveButton}>Approve</button>
                              <button className={styles.rejectButton}>Reject</button>
                              <button className={styles.reviseButton}>Revise</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.illustration}>
            <Image
              src="/api/placeholder/400/320"
              alt="Service process illustration"
              width={400}
              height={320}
              unoptimized
            />
          </div>
        </div>

        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setImageModalOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

