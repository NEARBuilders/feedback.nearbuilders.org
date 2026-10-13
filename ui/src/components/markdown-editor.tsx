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
  /**
   * Length limit. Edits past it are kept and flagged rather than dropped, so what the editor
   * shows is always what gets saved; callers block saving with `isOverLimit`.
   */
  maxLength?: number;
  /** How a value is measured against maxLength; defaults to its raw length. */
  measureLength?: (value: string) => number;
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
  measureLength = (next) => next.length,
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

  const overBy = maxLength == null ? 0 : measureLength(value) - maxLength;

  return (
    <>
      <Editor
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        disabled={disabled}
        format="markdown"
        enableImages
        enableImagePasteDrop
        onUploadImage={handleUploadImage}
        onRequestImage={handleRequestImage}
        onPendingUploadsChange={onPendingUploadsChange}
        className={className}
        editorClassName={editorClassName}
        aria-invalid={overBy > 0 || undefined}
      />
      {overBy > 0 && (
        <p role="alert" className="text-xs text-destructive" data-testid="editor-over-limit">
          {overBy.toLocaleString()} {overBy === 1 ? "character" : "characters"} over the{" "}
          {maxLength?.toLocaleString()} limit. Shorten it to save.
        </p>
      )}
    </>
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
