import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Initialize Supabase with service role key for server-side operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext;
}

function getFileType(mimeType: string, filename: string): string {
  const ext = getFileExtension(filename);

  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.includes("wordprocessingml") || ext === "docx") return "docx";
  if (mimeType === "application/msword" || ext === "doc") return "doc";
  if (mimeType === "text/plain" || ext === "txt") return "txt";
  if (mimeType.includes("spreadsheetml") || ext === "xlsx") return "xlsx";
  if (mimeType === "application/vnd.ms-excel" || ext === "xls") return "xls";

  return ext;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = getFileType(file.type, file.name);
    if (!ALLOWED_TYPES.includes(file.type) && !["pdf", "docx", "doc", "txt", "xlsx", "xls"].includes(fileType)) {
      return NextResponse.json(
        { error: "File type not supported. Please upload PDF, DOCX, TXT, or XLSX files." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${timestamp}_${safeFilename}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from("knowledge-base")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);

      // Check if bucket doesn't exist
      if (storageError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Storage bucket not configured. Please create 'knowledge-base' bucket in Supabase." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Create record in knowledge_base table
    const { data: dbRecord, error: dbError } = await supabase
      .from("knowledge_base")
      .insert({
        filename: file.name,
        file_type: fileType,
        file_size: file.size,
        status: "processing",
        content: null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from("knowledge-base").remove([storagePath]);

      return NextResponse.json(
        { error: "Failed to create database record" },
        { status: 500 }
      );
    }

    // Trigger processing in the background
    // We'll call the process endpoint asynchronously
    const processUrl = `${request.nextUrl.origin}/api/knowledge-base/process/${dbRecord.id}`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storagePath }),
    }).catch((err) => {
      console.error("Failed to trigger processing:", err);
    });

    return NextResponse.json({
      success: true,
      document: dbRecord,
      message: "File uploaded successfully. Processing started.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

// GET endpoint to list all documents
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ documents: data });
  } catch (error) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    // Get the document to find storage path
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_base")
      .select("filename")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("knowledge_base")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    // Note: We could also delete from storage here if we stored the path
    // For now, orphaned files in storage can be cleaned up periodically

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
