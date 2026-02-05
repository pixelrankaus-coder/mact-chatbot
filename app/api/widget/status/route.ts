import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create supabase client at runtime for server-side usage
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// CORS headers for widget
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// GET /api/widget/status - Check online/offline status based on operating hours
export async function GET() {
  try {
    const supabase = getSupabase();

    // Fetch operating hours settings
    const { data: operatingHoursData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "operating_hours")
      .single();

    const operatingHours = operatingHoursData?.value;

    // If operating hours not enabled, always online
    if (!operatingHours?.enabled) {
      return NextResponse.json(
        { online: true, reason: "always_on" },
        { headers: corsHeaders }
      );
    }

    // Get current time in the configured timezone
    const timezone = operatingHours.timezone || "UTC";
    const now = new Date();

    // Get localized day and time
    const localeDateString = now.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: timezone,
    });
    const day = localeDateString.toLowerCase();

    const localeTimeString = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });

    // Get schedule for today
    const schedule = operatingHours.schedule;
    const todaySchedule = schedule?.[day];

    // Check if closed today
    if (!todaySchedule?.enabled) {
      return NextResponse.json(
        {
          online: false,
          reason: "closed_today",
          message: "We're currently offline",
        },
        { headers: corsHeaders }
      );
    }

    // Parse current time and schedule times
    const [currentHour, currentMinute] = localeTimeString.split(":").map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = todaySchedule.start.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = todaySchedule.end.split(":").map(Number);
    const endMinutes = endHour * 60 + endMinute;

    // Check if within operating hours
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return NextResponse.json(
        { online: true, reason: "within_hours" },
        { headers: corsHeaders }
      );
    }

    // Outside operating hours
    const formatTime = (time: string) => {
      const [h, m] = time.split(":");
      const hour = parseInt(h);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    };

    return NextResponse.json(
      {
        online: false,
        reason: "outside_hours",
        message: `We're available ${formatTime(todaySchedule.start)} - ${formatTime(todaySchedule.end)}`,
        nextOpen: todaySchedule.start,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Status check error:", error);
    // Default to online if there's an error
    return NextResponse.json(
      { online: true, reason: "error_fallback" },
      { headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
