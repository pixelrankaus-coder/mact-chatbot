import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Initialize Supabase with service role key
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Dynamic imports for file processing (to avoid build issues)
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractTextFromXLSX(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let text = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    text += `\n--- Sheet: ${sheetName} ---\n${csv}`;
  }
  return text.trim();
}

function extractTextFromTXT(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

interface ProcessRequest {
  storagePath: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body: ProcessRequest = await request.json();
    const { storagePath } = body;

    if (!storagePath) {
      return NextResponse.json(
        { error: "Storage path required" },
        { status: 400 }
      );
    }

    // Get the document record
    const { data: doc, error: fetchError } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("knowledge-base")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);

      // Update status to error
      await supabase
        .from("knowledge_base")
        .update({ status: "error" })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to download file from storage" },
        { status: 500 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text based on file type
    let extractedText = "";
    const fileType = doc.file_type?.toLowerCase() || "";

    try {
      switch (fileType) {
        case "pdf":
          extractedText = await extractTextFromPDF(buffer);
          break;
        case "docx":
        case "doc":
          extractedText = await extractTextFromDOCX(buffer);
          break;
        case "xlsx":
        case "xls":
          extractedText = await extractTextFromXLSX(buffer);
          break;
        case "txt":
          extractedText = extractTextFromTXT(buffer);
          break;
        default:
          // Try to read as text
          extractedText = buffer.toString("utf-8");
      }
    } catch (extractError) {
      console.error("Text extraction error:", extractError);

      // Update status to error
      await supabase
        .from("knowledge_base")
        .update({ status: "error" })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to extract text from file" },
        { status: 500 }
      );
    }

    // Truncate if too long (keep first 100k characters)
    const maxLength = 100000;
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + "\n\n[Content truncated...]";
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Update database with extracted content
    const { error: updateError } = await supabase
      .from("knowledge_base")
      .update({
        content: extractedText,
        status: "ready",
      })
      .eq("id", id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save extracted content" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document processed successfully",
      contentLength: extractedText.length,
    });
  } catch (error) {
    console.error("Process error:", error);

    // Update status to error
    await supabase
      .from("knowledge_base")
      .update({ status: "error" })
      .eq("id", id);

    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
