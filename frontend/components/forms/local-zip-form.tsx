"use client";

import { useState, useRef, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { uploadLocalZip } from "@/utils/api";

interface LocalZipFormProps {
  onOutput: (text: string, file?: File) => void;
  onError: (error: string) => void;
  onLoading: () => void;
}

export function LocalZipForm({
  onOutput,
  onError,
  onLoading,
}: LocalZipFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      onError("Please select a ZIP file to upload");
      return;
    }

    onLoading();

    try {
      const result = await uploadLocalZip(file);
      // Pass both the text result and the file object for graph generation
      onOutput(result.text, file);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;

    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.name.endsWith(".zip")) {
        setFile(droppedFile);
      } else {
        onError("Only ZIP files are accepted");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-input hover:border-primary"
        }`}
        onClick={handleBrowseClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="local-zip-input"
          onChange={handleFileChange}
          className="hidden"
          accept=".zip"
        />
        <p className="mb-4 text-muted-foreground">
          Click to browse or drag and drop a ZIP file here
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            handleBrowseClick();
          }}
        >
          Select ZIP File
        </Button>
      </div>

      {file && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Selected file:</h3>
          <div className="p-2 border border-input rounded-md">
            <p className="text-sm">
              {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!file}>
        Process ZIP File
      </Button>
    </form>
  );
}
