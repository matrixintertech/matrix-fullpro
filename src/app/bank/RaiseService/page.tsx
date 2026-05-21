"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import type { ServiceRequestFormData } from "@/types/domain";
import type { CreateServiceRequestDto } from "@/types/api";
import { apiRequest } from "@/lib/api-client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import camera from "../../../../public/vectors/camera.png";
import styles from "./page.module.css";

const AddServiceRequest = () => {
  const [formData, setFormData] = useState<ServiceRequestFormData>({
    title: "",
    serviceType: "",
    description: "",
    photos: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submit = async () => {
      setError(null);
      setIsSubmitting(true);
      try {
        const payload: CreateServiceRequestDto = {
          title: formData.title,
          serviceType: formData.serviceType,
          description: formData.description,
        };
        await apiRequest("/api/service-requests", {
          method: "POST",
          withAuth: true,
          body: JSON.stringify(payload),
        });
        router.push("/bank/RaiseRequestList");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to create request");
      } finally {
        setIsSubmitting(false);
      }
    };
    void submit();
  };

  const handlePhotoUpload = (photos: string[]) => {
    setFormData((prevState) => ({
      ...prevState,
      photos,
    }));
  };
  return (
    <DashboardLayout>
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.heading}>Add a Service Request</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="title" className={styles.label}></label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                placeholder="Title"
                onChange={handleChange}
                required
                className={`${styles.input} ${styles.formGroup} ${styles.titleInput}`} /* Ensure the class is applied */
              />

            </div>
            <div className={styles.formGroup}>
              <label htmlFor="serviceType" className={styles.label}></label>
              <select
                id="serviceType"
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                
                required
                className={`${styles.select} ${styles.formGroup}  ${styles.serviceTypeSelect}`}
              >
                <option value="" disabled hidden>
                  Service type
                </option>
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </select>
              <div className="parentContainer">
                <div className={styles.multiSelect}>
                  Select Multiple
                </div>
              </div>

            </div>
            <div className={styles.formGroup}>
              <label htmlFor="description" className={styles["description-input"]}></label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Description"
                required
                className={`${styles.textarea} ${styles.formGroup}  ${styles.descriptionTextarea}`}
              ></textarea>
            </div>
            <div className={`${styles.formGroup} ${styles.photoUploadGroup}`}>
              <label htmlFor="photos" className={styles["add-before-text"]}>
                Add Before Photographs
              </label>
              <div
                className={styles.photoUpload}
                onClick={() => handlePhotoUpload(["photo1.jpg", "photo2.jpg"])}
              >
                <Image src={camera} alt="camera icon" className={styles.cameraIcon} width={24} height={24} />
                <span className={styles.addMultipleText}>+Add Multiple Images</span>
              </div>

            </div>
            <div className={styles.buttonContainer}>
              <button type="submit" className={styles.submitBtn}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
            {error ? <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p> : null}
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AddServiceRequest;

