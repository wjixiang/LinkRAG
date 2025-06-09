import AssistantSidebar from "@/components/chat_components/AssistantSidebar";
import GraphPage from "@/components/graph_visualization/GraphPage";

export default function Page() {
  return <div className="p-5 h-screen">
    <AssistantSidebar>
      <GraphPage/>
    </AssistantSidebar>
  </div>
}