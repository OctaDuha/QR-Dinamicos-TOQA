export type QrCode = {
  id: number;
  label: string | null;
  destination_url: string;
  created_at: string;
};

export type QrCodeWithStats = QrCode & {
  total_scans: number;
  last_scan_at: string | null;
};

export type ScanBucket = "day" | "week" | "month";

export type ScanSeriesPoint = {
  bucket_start: string;
  scans: number;
};
