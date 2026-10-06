import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useApiClient } from "@/app";

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
}

export function useFileUpload() {
  const apiClient = useApiClient();
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]): Promise<UploadedFile[]> => {
      const filesToUpload = Array.from(fileList);
      const results: UploadedFile[] = [];

      setUploading(true);
      try {
        for (const file of filesToUpload) {
          try {
            const contentType = file.type || "image/png";
            const uploadReq = await apiClient.storage.requestUpload({
              filename: file.name,
              contentType,
              sizeBytes: file.size,
            });

            const uploadRes = await fetch(uploadReq.presignedUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": contentType },
            });

            if (!uploadRes.ok) {
              throw new Error(`Upload failed with status ${uploadRes.status}`);
            }

            const asset = await apiClient.storage.confirmUpload({ key: uploadReq.key });

            results.push({ id: asset.id, url: asset.publicUrl, name: file.name });
          } catch (error) {
            toast.error(`Failed to upload ${file.name}`, {
              description: error instanceof Error ? error.message : "Upload failed",
            });
          }
        }
      } finally {
        setUploading(false);
      }

      return results;
    },
    [apiClient],
  );

  const uploadSingle = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const results = await uploadFiles([file]);
      return results[0] ?? null;
    },
    [uploadFiles],
  );

  return { uploadFiles, uploadSingle, uploading };
}
