export type QrCode = {
  id: number;
  label: string | null;
  destination_url: string;
  created_at: string;
  design_id: number | null;
};

export type QrCodeWithStats = QrCode & {
  design_name: string | null;
  total_scans: number;
  last_scan_at: string | null;
};

export type ScanBucket = "day" | "week" | "month";

export type ScanSeriesPoint = {
  bucket_start: string;
  scans: number;
};
