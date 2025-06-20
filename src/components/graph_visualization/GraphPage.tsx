"use client";

import { GraphViewer } from "@/components/graph_visualization/GraphViewer";
import { useEffect, useState } from "react";

interface GraphPageProps {
  onDocumentSelect?: (content: string) => void;
}

export default function GraphPage({ onDocumentSelect }: GraphPageProps) {
  const [graphData, setGraphData] = useState<{
    entity_data: any[];
    property_data: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/graph");
        if (!response.ok) {
          throw new Error("Failed to fetch graph data");
        }
        const data = await response.json();
        setGraphData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading graph data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!graphData) return <div>No graph data available</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Visualization</h1>
      <div className="border rounded-lg overflow-hidden">
        <GraphViewer data={graphData} onDocumentSelect={onDocumentSelect} />
      </div>
    </div>
  );
}
