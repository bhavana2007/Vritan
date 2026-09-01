import { useEffect, useState } from "react";

function CountdownTimer({ expiresAt, onExpire, className = "" }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const expiresStr = String(expiresAt);
      const expires = new Date(
        expiresStr.endsWith("Z") || expiresStr.includes("+")
          ? expiresStr
          : expiresStr + "Z"
      );
      const diff = expires - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Expired");
        if (onExpire) onExpire();
        return;
      }

      setIsExpired(false);
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  if (!timeLeft) return null;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
      isExpired
        ? "bg-gray-100 text-gray-800"
        : "bg-yellow-100 text-yellow-800"
    } ${className}`}>
      {timeLeft}
    </span>
  );
}

export default CountdownTimer;
