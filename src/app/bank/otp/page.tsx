"use client";
import { useState, useEffect } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiRequest } from "@/lib/api-client";
import { setAccessToken } from "@/lib/client-auth";
import type {
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "@/types/api";
import styles from "./page.module.css";
import "../../themes.css";

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    if (!Number.isNaN(Number(event.target.value))) {
      const newOtp = [...otp];
      newOtp[index] = event.target.value;
      setOtp(newOtp);

      const next = event.target.nextSibling;
      if (next instanceof HTMLInputElement && event.target.value !== "") {
        next.focus();
      }
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key === "Backspace") {
      const previous = event.currentTarget.previousSibling;
      if (!otp[index] && previous instanceof HTMLInputElement) {
        event.preventDefault();
        previous.focus();
      }
    }
  };

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setPhoneNumber(search.get("phone") ?? "");
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    setIsResendDisabled(false);
  }, [timer]);

  const handleResend = async () => {
    if (!phoneNumber) return;
    setError(null);
    try {
      const payload: SendOtpRequest = { phoneNumber };
      await apiRequest<SendOtpResponse>("/api/auth/otp/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOtp(new Array(6).fill(""));
      setTimer(60);
      setIsResendDisabled(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to resend OTP");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phoneNumber) {
      setError("Phone number is missing. Go back and retry login.");
      return;
    }

    const otpValue = otp.join("").trim();
    if (otpValue.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const payload: VerifyOtpRequest = {
        phoneNumber,
        otp: otpValue,
      };
      const data = await apiRequest<VerifyOtpResponse>("/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!data.accessToken) {
        throw new Error("Missing access token in OTP verification response");
      }
      setAccessToken(data.accessToken);
      router.push("/bank/RaiseRequestList");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "OTP verification failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles["center-container"]}>
      <div className="gradientContainer">
        <div className="imageWrapper">
          <Image
            src="/images/login.png"
            alt="Login illustration"
            className="loginImage"
            width={640}
            height={640}
          />
        </div>
      </div>

      <div className={styles["otp-verification-part"]}>
        <div className={styles["logo-container"]}>
          <Image src="/images/logo.png" alt="Matrix Logo" className={styles["logo-image"]} width={255} height={102} />
          <h2>OTP Verification</h2>
        </div>

        <div className={styles["verification-container"]}>
          <div className={styles["header-container"]}>
            <h2 className={styles.otp_head}>One Time Password</h2>
            <div className={styles["timer-container"]}>
              <span className={styles["time-left"]}>Time left</span>
              <div className={styles["timer-circle"]}>{timer}</div>
            </div>
          </div>

          <div className={styles["enter-otp-text"]}>Enter OTP</div>

          <form onSubmit={handleSubmit}>
            <div className={styles["otp-input-container"]}>
              {otp.map((data, index) => (
                <input
                  type="text"
                  key={index}
                  value={data}
                  maxLength={1}
                  className={styles["otp-input"]}
                  onChange={(event) => handleChange(event, index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  onFocus={(event) => event.target.select()}
                  autoComplete="off"
                />
              ))}
            </div>

            <button
              type="button"
              className={styles["resend-button"]}
              onClick={handleResend}
              disabled={isResendDisabled}
            >
              Resend Code
            </button>

            <button type="submit" className={styles["login-button"]} disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Log In"}
            </button>
            {error ? <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p> : null}
          </form>
        </div>
      </div>
    </div>
  );
}
