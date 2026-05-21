"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import { apiRequest } from "@/lib/api-client";
import type { SendOtpRequest, SendOtpResponse } from "@/types/api";
import styles from "./page.module.css";
import "../themes.css";

export default function LoginPage() {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const payload: SendOtpRequest = { phoneNumber: mobileNumber };
      await apiRequest<SendOtpResponse>("/api/auth/otp/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/bank/otp?phone=${encodeURIComponent(mobileNumber)}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles["center-container"]}>
      <div className="gradientContainer">
        <div className="imageWrapper">
          <Image src="/images/login.png" alt="login" className="loginImage" width={640} height={640} />
        </div>
      </div>

      <div className={styles["form-container"]}>
        <form onSubmit={handleSubmit} className={styles["login-form"]}>
          <div className={styles["logo-container"]}>
            <Image src="/images/logo.png" alt="login" className={styles["logo-image"]} width={255} height={102} />
            <h1 className={styles["welcome-Text"]}>Welcome to Matrix ERP</h1>
          </div>

          <h2 className={styles["login-head"]}>Login</h2>
          <div className={styles["input-container"]}>
            <label className={styles.mobile}>Mobile</label>
            <div className={styles["input-field"]}>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                required
                placeholder="Enter your mobile number"
                pattern="[0-9]{10}"
                maxLength={10}
              />
            </div>
          </div>
          <button type="submit" className={styles["get-otp"]}>
            {isSubmitting ? "Sending..." : "Get code"}
          </button>
          {error ? <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
