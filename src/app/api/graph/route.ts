import { fetchGraphData } from "@/components/graph_visualization/graphDataFetcher";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const graphData = await fetchGraphData();
    return NextResponse.json(graphData);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
