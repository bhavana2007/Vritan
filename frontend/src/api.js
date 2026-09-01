/** Backend base URL - set VITE_API_URL in `.env` for production. */
export const API_BASE =
  import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

/** Readable message from FastAPI `HTTPException` or validation errors */
export function parseFastApiDetail(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request failed.";
  }
  const { detail } = payload;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item.msg === "string" ? item.msg : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "Request failed.";
}
