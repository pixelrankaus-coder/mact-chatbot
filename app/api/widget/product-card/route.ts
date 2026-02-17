import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/widget/product-card?slug=concrete-benchtop-starter-kit
 * Returns product name, price, and image for a product card in the chat widget.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400, headers: corsHeaders });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("woo_products")
      .select("name, slug, price, image_url")
      .eq("slug", slug)
      .eq("status", "publish")
      .single();

    if (error || !data) {
      return NextResponse.json({ found: false }, { headers: corsHeaders });
    }

    return NextResponse.json({
      found: true,
      product: {
        name: data.name,
        price: data.price ? `$${parseFloat(data.price).toFixed(2)}` : null,
        image: data.image_url || null,
        url: `https://mact.au/product/${data.slug}/`,
      },
    }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({ found: false }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
