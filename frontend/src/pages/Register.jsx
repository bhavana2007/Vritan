import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import { API_BASE, parseFastApiDetail } from "../api";

/** Keep only digits — matches backend normalization (10-15 digits). */
function normalizeMobileDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function Register() {
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [hospital, setHospital] = useState("");
  const [password, setPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name.trim() || !password) {
      alert("Please fill all required fields.");
      return;
    }

    if (role === "patient") {
      const digits = normalizeMobileDigits(mobile);
      if (digits.length < 10) {
        alert("Please enter a valid mobile number (at least 10 digits).");
        return;
      }
    }

    if (role === "doctor") {
      if (!email.trim()) {
        alert("Email is required for doctor registration.");
        return;
      }
      if (!hospital.trim()) {
        alert("Please enter hospital name.");
        return;
      }
    }

    const userData =
      role === "patient"
        ? {
            role,
            name: name.trim(),
            password,
            mobile: normalizeMobileDigits(mobile),
          }
        : {
            role,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            hospital: hospital.trim(),
          };

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(parseFastApiDetail(data));
      }

      setSuccessMessage(data.message);

      setTimeout(() => {
        navigate("/", {
          replace: true,
          state: { registrationSuccess: true },
        });
      }, 1500);
    } catch (error) {
      console.error(error);

      const msg =
        error instanceof Error ? error.message : "Registration failed.";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center mb-6">
          Register
        </h1>

        <select
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white"
          value={role}
          disabled={submitting || Boolean(successMessage)}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="patient">Patient Registration</option>
          <option value="doctor">Doctor Registration</option>
        </select>

        <input
          type="text"
          placeholder="Enter Name"
          value={name}
          disabled={submitting || Boolean(successMessage)}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none"
        />

        {role === "patient" ? (
          <input
            type="tel"
            placeholder="Mobile number"
            autoComplete="tel"
            inputMode="numeric"
            value={mobile}
            disabled={submitting || Boolean(successMessage)}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none"
          />
        ) : (
          <>
            <input
              type="email"
              placeholder="Professional email"
              autoComplete="email"
              value={email}
              disabled={submitting || Boolean(successMessage)}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none"
            />

            <input
              type="text"
              placeholder="Enter Hospital Name"
              value={hospital}
              disabled={submitting || Boolean(successMessage)}
              onChange={(e) => setHospital(e.target.value)}
              className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none"
            />
          </>
        )}

        <input
          type="password"
          placeholder="Enter Password"
          value={password}
          disabled={submitting || Boolean(successMessage)}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 rounded-lg bg-slate-700 text-white outline-none"
        />

        <button
          type="button"
          onClick={handleRegister}
          disabled={submitting || Boolean(successMessage)}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white p-3 rounded-lg"
        >
          {submitting ? "Saving…" : "Register"}
        </button>

        {successMessage ? (
          <p className="text-green-400 text-center mt-4 text-sm">
            {successMessage} Redirecting…
          </p>
        ) : null}

        <p className="text-gray-300 text-sm text-center mt-4">
          Already have an account?{" "}
          <Link to="/" className="text-blue-400">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
