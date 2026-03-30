export const formatCount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(typeof value === "string" ? Number(value) : value);
};

export const formatLongCount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  return new Intl.NumberFormat("en-US").format(
    typeof value === "string" ? Number(value) : value,
  );
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export const formatTimestamp = (value: number | null | undefined) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export const formatDuration = (seconds: number | null | undefined) => {
  if (!seconds || seconds < 1) {
    return "0:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};
