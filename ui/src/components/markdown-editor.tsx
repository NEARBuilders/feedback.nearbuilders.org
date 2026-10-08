import { ClientOnly } from "@tanstack/react-router";
import { useCallback } from "react";

import { Editor, type ImagePickerResult, type ImageUploadResult } from "@/components/ui/editor";
import { useFileUpload } from "@/hooks";

const pickImageFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      input.remove();
      resolve(file);
    };

    const onChange = () => {
      const file = input.files?.[0] ?? null;
      finish(file);
    };
    const onCancel = () => finish(null);

    input.addEventListener("change", onChange);
    input.addEventListener("cancel", onCancel);
    input.click();
  });

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Hard cap on stored markdown length: edits that would exceed it are reverted. */
  maxLength?: number;
  onPendingUploadsChange?: (count: number) => void;
  className?: string;
  editorClassName?: string;
  id?: string;
  "aria-label"?: string;
}

function MarkdownEditorSurface({
  value,
  onChange,
  disabled,
  maxLength,
  onPendingUploadsChange,
  className,
  editorClassName,
  id,
  "aria-label": ariaLabel,
}: MarkdownEditorProps) {
  const { uploadSingle } = useFileUpload();

  const handleUploadImage = async (file: File): Promise<ImageUploadResult | null> => {
    const uploaded = await uploadSingle(file);
    if (!uploaded) return null;
    return { src: uploaded.url };
  };

  const handleRequestImage = useCallback(async (): Promise<ImagePickerResult | null> => {
    const file = await pickImageFile();
    return file ? { kind: "file", file } : null;
  }, []);

  const handleChange = (next: string) => {
    if (maxLength != null && next.length > maxLength) return;
    onChange(next);
  };

  return (
    <Editor
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      format="markdown"
      enableImages
      enableImagePasteDrop
      onUploadImage={handleUploadImage}
      onRequestImage={handleRequestImage}
      onPendingUploadsChange={onPendingUploadsChange}
      className={className}
      editorClassName={editorClassName}
    />
  );
}

/**
 * Markdown WYSIWYG editor (pagescms-editor / TipTap) with image paste/drop wired
 * to the storage plugin's presigned-upload flow. Client-only: TipTap can't run on
 * the server, so SSR renders a matching skeleton until hydration.
 */
export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <ClientOnly
      fallback={
        <div
          className="min-h-24 w-full animate-pulse rounded-md border border-input bg-transparent"
          aria-hidden="true"
        />
      }
    >
      <MarkdownEditorSurface {...props} />
    </ClientOnly>
  );
}
